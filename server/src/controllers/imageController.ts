import type { Request, Response } from "express";
import { z } from "zod";
import { createImage, deleteImage, getImageOrThrow, listImages, toImageDto } from "../services/imageService";
import { HttpError } from "../utils/httpError";
import { IMAGE_STATUSES } from "../types/domain";

const listQuerySchema = z.object({
  status: z.enum(IMAGE_STATUSES).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new HttpError(400, "No file provided. Attach it under the 'image' field.");
  }

  const sourceIdRaw = req.body?.sourceId;
  const sourceId = typeof sourceIdRaw === "string" && sourceIdRaw.length > 0 ? sourceIdRaw.slice(0, 128) : null;

  const image = await createImage({
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    sourceId,
  });

  res.status(202).json(await toImageDto(image));
}

export async function getImages(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  const { items, nextCursor } = await listImages(query);
  const dtos = await Promise.all(items.map((item) => toImageDto(item)));
  res.status(200).json({ items: dtos, nextCursor });
}

export async function getImage(req: Request, res: Response): Promise<void> {
  const image = await getImageOrThrow(req.params.id as string);
  res.status(200).json(await toImageDto(image, true));
}

export async function removeImage(req: Request, res: Response): Promise<void> {
  await deleteImage(req.params.id as string);
  res.status(204).send();
}
