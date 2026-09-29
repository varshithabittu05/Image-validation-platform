import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import { HttpError } from "../utils/httpError";

export { HttpError };

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof Error && err.message.startsWith("Unsupported content type")) {
    res.status(400).json({ error: err.message });
    return;
  }

  logger.error({ err, path: req.path }, "unhandled request error");
  res.status(500).json({ error: "Internal server error" });
}
