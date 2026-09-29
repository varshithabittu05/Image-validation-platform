import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement these; the app relies on them for local previews
// and per-tab session ids, so tests get lightweight, deterministic stand-ins.
if (!("createObjectURL" in URL)) {
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock-url", writable: true });
}
if (!("revokeObjectURL" in URL)) {
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, writable: true });
}

let uuidCounter = 0;
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => `test-uuid-${++uuidCounter}` },
    writable: true,
  });
}
