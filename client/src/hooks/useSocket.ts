import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/client";
import type { ImageStatusEvent } from "../types";

const IMAGE_STATUS_EVENT = "image:status";

/**
 * Opens one socket per mount, joins the caller's session room, and forwards
 * every "image:status" push to `onStatus`. Using a ref for the callback
 * (rather than re-subscribing on every render) avoids tearing down and
 * reopening the socket connection each time the parent re-renders.
 */
export function useSocket(sourceId: string, onStatus: (event: ImageStatusEvent) => void): void {
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    // Deliberately not forcing "websocket" first: corporate networks/proxies
    // often block raw WebSocket upgrades outright, so Socket.IO's default
    // (start on HTTP long-polling, upgrade to WebSocket only if that
    // handshake actually succeeds) is more resilient than assuming
    // WebSocket works and never falling back.
    const socket: Socket = io(API_BASE_URL);

    socket.on("connect", () => {
      socket.emit("join", sourceId);
    });

    socket.on(IMAGE_STATUS_EVENT, (event: ImageStatusEvent) => {
      onStatusRef.current(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [sourceId]);
}
