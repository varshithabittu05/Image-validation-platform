# Image Validation Platform

A full-stack reference implementation of an image upload pipeline that categorizes
uploads into **Accepted** and **Rejected** based on six validation rules (format,
resolution, duplicate, blur, face size, multiple faces), with real-time status
updates in the browser.

## Architectural Blueprint

- **Upload is decoupled from validation.** `POST /api/images` does the minimum
  needed to respond fast: sniff & store the raw bytes in S3-compatible storage,
  write a `PENDING` row, and hand the image id to an in-process async queue
  (`src/queue/imageProcessingQueue.ts`: an in-memory FIFO with a concurrency
  cap). The actual pipeline (format → resolution → duplicate → blur → face
  checks) then runs off the request/response cycle, so a slow face-detection
  model or a burst of uploads never blocks the HTTP thread. (This queue is
  intentionally in-process rather than Redis/BullMQ-backed -- see "Why no
  Redis?" below.)
- **The database is the source of truth for validation history, not just the
  final verdict.** `Image` holds the current state; `ValidationResult` holds
  one row per rule *actually evaluated* (rules short-circuit on first failure,
  so a rejected image doesn't have rows for rules that never ran). This keeps
  "why was this rejected" fully queryable without re-deriving it from logs.
- **Near-duplicate detection runs as a database query, not an app-level scan.**
  A 64-bit difference hash (dHash) is stored per image in a `BIT(64)` column;
  finding the closest match is `SELECT ... bit_count(hash # $1) ... ORDER BY
  distance LIMIT 1`, letting Postgres's own engine do the comparison instead of
  shipping every row to Node. A short-lived Postgres advisory lock wraps the
  "check for a duplicate, then decide" step specifically to close the race
  window where two near-identical images uploaded at the same instant could
  otherwise both read "no duplicate yet" and both get accepted.
- **Real-time feedback via a direct Socket.IO push.** Since the pipeline runs
  in the same process that holds the browser's socket connection, a status
  change just calls `io.to(sessionRoom).emit(...)` directly (`src/lib/socketEmitter.ts`)
  -- no polling, and no cross-process message bus needed for a single instance.
- **Edge cases handled explicitly:** decompression-bomb guard on decode
  (`limitInputPixels`), magic-byte format sniffing on both client and server
  (never trusting a declared MIME type or file extension), EXIF/GPS stripped
  from every stored image, presigned short-TTL URLs instead of a public
  bucket, keyset (not OFFSET) pagination so listing stays fast as the table
  grows, and rejected images still get a thumbnail so the UI can show *what*
  was rejected, not just that something was.

## Assumptions

- The spec's numbered validation order is a requirements list, not an
  execution order: format is checked before resolution because you cannot
  safely measure the resolution of a file whose format hasn't been verified
  yet (decoding an unverified buffer is itself a risk). See `src/validation/pipeline.ts`.
- "Reject if the detected face is too small" and "reject if multiple faces"
  presuppose at least one face. Zero faces detected is treated as a pass for
  both rules -- the spec doesn't ask for "must contain a face," only that a
  *present* face not be too small or accompanied by others. This is called out
  in `faceSizeRule.ts` and easy to flip if the intended behavior is stricter.
- There's no authentication layer. Uploads are scoped to a browser-generated
  `sourceId` (persisted in `sessionStorage`) purely for routing real-time
  events back to the right tab -- it is not a security boundary. Adding auth
  would mean scoping `Image.sourceId` to an authenticated user id instead.
- Local infra (Docker) turned out to be unreliable in a corporate/VPN
  environment where the registry mirror blocks some public images. Rather
  than fight that, this runs against two free hosted services instead:
  **Neon** (serverless Postgres) and **Cloudflare R2** (S3-compatible
  storage) -- both reachable over plain HTTPS, no Docker required. The
  storage code talks to the plain S3 API (`@aws-sdk/client-s3`), so it's
  unmodified from what would be needed for real AWS S3 or local MinIO --
  only the endpoint/credential env vars differ.
- **Why no Redis?** The spec asks for an efficient *asynchronous* processing
  system, not specifically a durable multi-process job queue. Redis/BullMQ
  was the initial design (see git history) but was deliberately dropped in
  favor of a single-process in-memory queue to remove a whole moving part
  for local dev/demo use. The tradeoff: an in-flight job is lost if the
  process crashes (no retry-on-restart), and this can't scale to more than
  one API instance without reintroducing a shared queue. Both `imageProcessingQueue.ts`
  and `socketEmitter.ts` are small, isolated modules specifically so that
  swapping back to BullMQ + a Redis-backed Socket.IO adapter later only
  touches those two files, not the validation pipeline or controllers.

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | Node.js + Express + TypeScript | REST per the spec; TypeScript for the type-safety requirement |
| DB | PostgreSQL (hosted on Neon) + Prisma | Native `BIT`/`bit_count()` support for the duplicate-check query; Prisma for migrations + type-safe queries; Neon avoids needing local Docker |
| Object storage | Cloudflare R2 (S3 API-compatible) | Free tier, no Docker/local infra needed; same code path works against real AWS S3 or MinIO |
| Queue | In-process (in-memory FIFO, concurrency-capped) | Async processing without a Redis dependency -- see "Why no Redis?" |
| Real-time | Socket.IO (direct emit) | Push status to the browser without polling |
| Image processing | sharp | Resize, format conversion, EXIF stripping, Laplacian convolution for blur |
| HEIC decoding | heic-convert (WASM libheif) | Avoids a native libvips-with-libheif build of `sharp` |
| Face detection | `@vladmandic/face-api` + `@tensorflow/tfjs-node` | Runs on raw tensors, no native `canvas` dependency |
| Frontend | React + TypeScript + Vite | Per the spec; Vite for a fast scratch-project dev loop |

## Project layout

```
image-validation-platform/
  server/                    # REST API + in-process validation pipeline
    prisma/schema.prisma
    src/
      config/                # env validation (zod), constants
      lib/                   # prisma client, s3 client, imageStore repository, logger, socket wiring
      services/              # storage, hashing, blur, HEIC, face detection
      validation/
        rules/                # one file per validation rule
        pipeline.ts           # orchestrates the rules for one image
      queue/                  # in-process async queue (see "Why no Redis?")
      controllers/, routes/, middleware/
      server.ts                # HTTP + Socket.IO entrypoint; also preloads the face model
    scripts/download-models.ts # fetches face-detector weights (not committed)
    tests/unit/
  client/
    src/
      api/client.ts           # fetch wrapper
      hooks/                  # useImageUpload (state machine), useSocket, useToasts
      components/             # dropzone, gallery, toast UI
      utils/                  # magic-byte format sniffing, session id
    tests/
```

## Setup

### 1. Provision hosted infra (free tiers, no Docker needed)

1. **Postgres**: create a free project at [neon.tech](https://neon.tech) and copy its connection string.
2. **Storage**: create a bucket in [Cloudflare R2](https://dash.cloudflare.com) and an API token
   (Object Read & Write, scoped to that bucket) to get an Access Key ID, Secret Access Key,
   and endpoint (`https://<account-id>.r2.cloudflarestorage.com`).

### 2. Backend

```bash
cd server
cp .env.example .env         # then fill in DATABASE_URL and the S3_* values from step 1
npm install
npm run prisma:migrate       # creates the Image / ValidationResult tables on Neon
npm run download-models      # fetches the tiny-face-detector weights into ./models
npm run dev                  # API server on :4000 -- also runs the validation pipeline in-process
```

### 3. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Upload a PNG/JPG/HEIC file and it will appear in "In Progress," then move to
"Accepted Photos" or "Needs Attention" (hover a rejected thumbnail for the
specific reason) once the pipeline finishes processing it.

## Validation rules & thresholds

All thresholds are environment variables (see `server/.env.example`), not
hardcoded, so they can be tuned per deployment without a code change.

| Rule | Threshold (default) | Notes |
|---|---|---|
| Format | JPEG / PNG / HEIC / HEIF only | Verified via magic bytes (`file-type`), not the declared MIME type |
| Resolution | ≥ 400×400px and ≥ 10KB | Both must hold |
| Duplicate | Hamming distance ≤ 8 (of 64 bits) | dHash compared against every *accepted* image via `bit_count()` |
| Blur | Laplacian variance ≥ 60 | Computed on a downscaled grayscale copy |
| Face size | face bbox area ≥ 3% of image area | Only evaluated when exactly one face is present |
| Multiple faces | > 1 face detected | Runs before the face-size check |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/images` | multipart upload (`image` file + `sourceId` field); returns `202` immediately, processing happens async |
| `GET` | `/api/images?status=&cursor=&limit=` | Keyset-paginated list |
| `GET` | `/api/images/:id` | Single image + its validation result history |
| `DELETE` | `/api/images/:id` | Removes the DB row and its storage objects |

Real-time: connect a Socket.IO client, emit `join` with your `sourceId`, and
listen for `image:status` events (`{ imageId, status, rejectionReason? }`).

## Testing

```bash
cd server && npm test
cd client && npm test
```

Backend tests cover rule boundary values (exact-threshold pass/fail), null/zero
inputs, a simulated DB failure during the duplicate check, and pipeline
short-circuiting (asserting the expensive face-detection/blur steps never run
once an earlier rule has already failed). Frontend tests cover magic-byte
format sniffing (including a deliberately mislabeled file), the upload state
machine (`VALIDATING → UPLOADING → server status`, and its `INVALID` /
`UPLOAD_FAILED` branches), and drag-and-drop/file-input wiring.

## Security notes

- Every uploaded file is re-verified by magic bytes server-side; the
  client-side check is UX-only and never trusted as the security boundary.
- Storage keys are server-generated UUIDs -- the client-supplied filename is
  stored as metadata only, never used to construct a path.
- Decoded pixel count is capped (`limitInputPixels`) to prevent a small file
  that decompresses into a huge bitmap from exhausting worker memory.
- Images are served via short-TTL presigned URLs; the bucket itself is never
  public.
- EXIF (including GPS) is stripped from every processed image.
