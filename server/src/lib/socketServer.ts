import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "./logger";
import { sourceRoom } from "./socketEvents";

let ioInstance: SocketIOServer | null = null;

/**
 * Single-process deployment: the same server that accepts uploads also runs
 * the validation pipeline and holds every browser's socket connection, so
 * `io.to(room).emit(...)` can be called directly -- no cross-process
 * pub/sub needed. (If this ever needs to scale to multiple API instances,
 * reintroducing a Redis-backed adapter is the natural next step, but it's
 * unnecessary complexity for a single instance.)
 */
export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, { cors: { origin: env.CORS_ORIGIN } });
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("join", (sourceId: unknown) => {
      if (typeof sourceId !== "string" || sourceId.length === 0 || sourceId.length > 128) {
        return;
      }
      socket.join(sourceRoom(sourceId));
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "socket disconnected");
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!ioInstance) {
    throw new Error("Socket server has not been initialized yet -- call createSocketServer() first.");
  }
  return ioInstance;
}
