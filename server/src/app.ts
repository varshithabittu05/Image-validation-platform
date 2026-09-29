import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { imageRoutes } from "./routes/imageRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { STORAGE_ROOT } from "./config/constants";

export function createApp(): Express {
  const app = express();

  // crossOriginResourcePolicy is relaxed only because /files below serves
  // images that must render in an <img> tag on the frontend's own origin
  // (localhost:5173) -- helmet's same-origin default would otherwise block them.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Stands in for a real object store's public/presigned URL -- see
  // getPublicObjectUrl() in storageService.ts.
  app.use("/files", express.static(STORAGE_ROOT));

  app.use("/api/images", imageRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
