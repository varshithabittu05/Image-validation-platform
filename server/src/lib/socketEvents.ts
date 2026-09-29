/** Shared contract between the API server (which owns client connections)
 * and the worker process (which produces status changes and has no direct
 * socket connections of its own). */
export const IMAGE_STATUS_EVENT = "image:status" as const;

export function sourceRoom(sourceId: string): string {
  return `source:${sourceId}`;
}
