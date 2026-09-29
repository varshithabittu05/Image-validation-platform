import { ImageStatus } from "@prisma/client";

jest.mock("../../src/services/storageService", () => ({
  buildStorageKey: jest.fn(() => "originals/fixed-key.jpg"),
  uploadObject: jest.fn(),
  deleteObject: jest.fn(),
  getSignedObjectUrl: jest.fn(async (key: string) => `https://signed.example/${key}`),
}));

jest.mock("../../src/queue/imageProcessingQueue", () => ({
  enqueueImageProcessing: jest.fn(),
}));

jest.mock("../../src/lib/prisma", () => ({
  prisma: {
    image: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from "../../src/lib/prisma";
import { uploadObject } from "../../src/services/storageService";
import { enqueueImageProcessing } from "../../src/queue/imageProcessingQueue";
import { createImage, deleteImage, listImages } from "../../src/services/imageService";

const mockedPrisma = prisma as unknown as {
  image: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
};

describe("createImage", () => {
  it("uploads the buffer, persists metadata, and enqueues a processing job", async () => {
    mockedPrisma.image.create.mockResolvedValue({ id: "img-1", sourceId: "session-1" });

    const image = await createImage({
      buffer: Buffer.from("fake-bytes"),
      originalFilename: "photo.jpg",
      mimeType: "image/jpeg",
      sourceId: "session-1",
    });

    expect(uploadObject).toHaveBeenCalledWith("originals/fixed-key.jpg", expect.any(Buffer), "image/jpeg");
    expect(mockedPrisma.image.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceId: "session-1",
        originalFilename: "photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: Buffer.from("fake-bytes").length,
        originalStorageKey: "originals/fixed-key.jpg",
      }),
    });
    expect(enqueueImageProcessing).toHaveBeenCalledWith("img-1");
    expect(image.id).toBe("img-1");
  });

  it("propagates a storage failure and never creates a DB row or enqueues a job", async () => {
    (uploadObject as jest.Mock).mockRejectedValueOnce(new Error("S3 unreachable"));

    await expect(
      createImage({ buffer: Buffer.from("x"), originalFilename: "a.png", mimeType: "image/png", sourceId: null })
    ).rejects.toThrow("S3 unreachable");

    expect(mockedPrisma.image.create).not.toHaveBeenCalled();
    expect(enqueueImageProcessing).not.toHaveBeenCalled();
  });
});

describe("listImages", () => {
  it("requests one extra row to detect whether a next page exists, and trims it from the result", async () => {
    mockedPrisma.image.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);

    const result = await listImages({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.nextCursor).toBe("b");
    expect(mockedPrisma.image.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );
  });

  it("returns a null cursor when fewer rows than the limit come back", async () => {
    mockedPrisma.image.findMany.mockResolvedValue([{ id: "a" }]);

    const result = await listImages({ limit: 5 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

describe("deleteImage", () => {
  it("throws a 404-shaped error when the image does not exist", async () => {
    mockedPrisma.image.findUnique.mockResolvedValue(null);

    await expect(deleteImage("missing-id")).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.image.delete).not.toHaveBeenCalled();
  });

  it("only deletes the storage keys that are actually set, then deletes the DB row", async () => {
    const { deleteObject } = jest.requireMock("../../src/services/storageService");
    mockedPrisma.image.findUnique.mockResolvedValue({
      id: "img-2",
      status: ImageStatus.REJECTED,
      originalStorageKey: "originals/a.jpg",
      processedStorageKey: null,
      thumbnailStorageKey: "thumbnails/a.jpg",
    });

    await deleteImage("img-2");

    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenCalledWith("originals/a.jpg");
    expect(deleteObject).toHaveBeenCalledWith("thumbnails/a.jpg");
    expect(mockedPrisma.image.delete).toHaveBeenCalledWith({ where: { id: "img-2" } });
  });
});
