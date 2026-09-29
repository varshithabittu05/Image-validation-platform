import { IMAGE_STATUS_EVENT, sourceRoom } from "./socketEvents";
import { getSocketServer } from "./socketServer";
import type { ImageStatusEvent } from "../types/domain";

export function emitImageStatus(event: ImageStatusEvent): void {
  if (!event.sourceId) return;
  getSocketServer().to(sourceRoom(event.sourceId)).emit(IMAGE_STATUS_EVENT, event);
}
