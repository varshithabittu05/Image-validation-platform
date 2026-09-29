import { fileTypeFromBuffer } from "file-type";
import { evaluateFormatRule } from "../../src/validation/rules/formatRule";

jest.mock("file-type", () => ({ fileTypeFromBuffer: jest.fn() }));

const mockedFileTypeFromBuffer = fileTypeFromBuffer as jest.MockedFunction<typeof fileTypeFromBuffer>;

describe("evaluateFormatRule", () => {
  it("passes for a supported format detected from magic bytes", async () => {
    mockedFileTypeFromBuffer.mockResolvedValue({ mime: "image/jpeg", ext: "jpg" } as never);
    const outcome = await evaluateFormatRule(Buffer.from([0xff, 0xd8]));
    expect(outcome.passed).toBe(true);
    expect(outcome.metadata).toEqual({ detectedMimeType: "image/jpeg" });
  });

  it("fails for a real but unsupported format (e.g. GIF)", async () => {
    mockedFileTypeFromBuffer.mockResolvedValue({ mime: "image/gif", ext: "gif" } as never);
    const outcome = await evaluateFormatRule(Buffer.from("GIF89a"));
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/unsupported/i);
  });

  it("fails when the buffer's real bytes don't match any known file signature", async () => {
    mockedFileTypeFromBuffer.mockResolvedValue(undefined);
    const outcome = await evaluateFormatRule(Buffer.from("not an image, e.g. a spoofed .jpg"));
    expect(outcome.passed).toBe(false);
  });

  it("ignores a spoofed extension/MIME and trusts only the sniffed bytes", async () => {
    // Simulates a .exe renamed to photo.jpg: file-type looks at magic bytes,
    // not the filename, so it correctly reports the real format.
    mockedFileTypeFromBuffer.mockResolvedValue({ mime: "application/x-msdownload", ext: "exe" } as never);
    const outcome = await evaluateFormatRule(Buffer.from("MZ..."));
    expect(outcome.passed).toBe(false);
  });
});
