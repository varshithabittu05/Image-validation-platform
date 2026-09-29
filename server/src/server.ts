import { createServer } from "http";
import { createApp } from "./app";
import { createSocketServer } from "./lib/socketServer";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { ensureStorageReady } from "./services/storageService";
import { loadFaceModels } from "./services/faceDetectionService";

async function main(): Promise<void> {
  await ensureStorageReady();
  // Loaded eagerly so the first upload doesn't pay the multi-second model
  // load cost; a failure here (e.g. models not downloaded yet) is logged
  // but doesn't stop the server -- it will retry on the first job instead.
  await loadFaceModels().catch((error) => {
    logger.error({ err: error }, "failed to preload face detection models; will retry on first job");
  });

  const app = createApp();
  const httpServer = createServer(app);
  createSocketServer(httpServer);

  const server = httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API server listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "API server shutting down");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ err: error }, "server failed to start");
  process.exitCode = 1;
});
