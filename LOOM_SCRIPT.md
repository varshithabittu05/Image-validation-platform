# Loom walkthrough script (~15-18 min)

Read this through once so it's in your head, then talk it in your own
words on camera -- don't read it verbatim, that reads as stiff on video.
Treat each **📂 OPEN** line as your cue for what to have on screen; the
paragraph under it is roughly what you'd say there, not a script to recite.

Fixtures for the QA section are in `demo-assets/`. Record your own screen at
`localhost:5173` in a real browser tab, not the Claude preview pane.

---

## 1. Intro (1-2 min)

**📂 OPEN:** the running app at `localhost:5173`

So this is an image upload tool that sorts photos into Accepted and
Rejected based on six checks -- format, resolution, duplicates, blur, face
size, and multiple faces. Everything on the right updates live as photos
get processed, there's no refreshing needed. On the left is the upload
area, and if you scroll down there's a Photo Requirements and Photo
Restrictions section that's basically a plain-English version of the same
six rules -- so a user knows upfront what's expected instead of finding out
after getting rejected.

---

## 2. Architecture (5-6 min)

### Frontend

**📂 OPEN:** `client/src/hooks/useImageUpload.ts` — the `GalleryItem` status
union and the `addFiles` function

The frontend's in React with TypeScript. This hook is really the brain of
the upload flow -- every photo moves through a little state machine, so it
goes from validating, to uploading, to pending, to processing, and then
lands on either accepted or rejected. `addFiles` is what kicks that off --
it checks the file on the client first, and only then actually uploads it.

**📂 OPEN:** `client/src/utils/fileValidation.ts` — `detectImageFormat`

And that client-side check isn't just looking at the file extension -- it's
reading the actual magic bytes of the file. I did it that way because
browsers are inconsistent about what MIME type they report for HEIC files,
and an extension can just be wrong, or spoofed.

**📂 OPEN:** `client/src/hooks/useSocket.ts`

This is the piece that makes the real-time updates work -- it's Socket.IO,
but I deliberately let it fall back to polling instead of forcing
WebSocket, because a lot of corporate networks and proxies just block raw
WebSocket upgrades outright, and I'd rather it always work than be
theoretically faster but silently broken on some networks.

### Backend

**📂 OPEN:** `server/src/controllers/imageController.ts` — `uploadImage`

On the backend, when you hit `POST /api/images`, it does the bare minimum
to respond fast -- saves the file, writes a row to the database, hands the
image off to a queue, and immediately returns. The actual checking happens
after that, in the background, so a slow face-detection model never makes
the upload itself feel slow.

**📂 OPEN:** `server/src/validation/pipeline.ts` — scroll through
`processImage` top to bottom

This is where all six rules actually run, one file per rule. They run
cheapest and safest first -- format gets checked before anything else,
because you genuinely can't safely try to decode a file you haven't
verified yet. And it stops at the first rule that fails, since the UI only
ever needs to show one rejection reason per photo anyway.

**📂 OPEN:** `server/src/validation/rules/duplicateRule.ts` —
`findClosestDuplicate`

For duplicates, I'm using something called a difference hash -- it's a
64-bit fingerprint of the image that's tolerant to re-compression and small
edits, so it catches "basically the same photo" rather than only catching
byte-for-byte identical files.

**📂 OPEN:** `server/src/services/blurService.ts` — `computeBlurVariance`
and the limitation comment above it

Blur detection is a Laplacian filter plus variance -- that's a pretty
standard way to estimate sharpness. I'll come back to this specific
function later, because I actually found a real limitation in it while
testing, and I want to walk through that.

**📂 OPEN:** `server/src/services/faceDetectionService.ts` — `detectFaces`

Face detection runs on `@vladmandic/face-api` on top of TensorFlow for
Node, working directly on tensors instead of going through the `canvas`
package -- `canvas` is a really common source of broken installs because
it needs native build tools, so avoiding it made setup a lot more reliable.

**📂 OPEN:** `server/src/services/heicConversionService.ts`

HEIC conversion uses a library called `heic-convert`, which is a WASM build
of libheif. I needed that because `sharp`'s prebuilt binaries don't
actually include HEIC support out of the box.

**📂 OPEN:** `server/prisma/schema.prisma`

And for storage, it's Postgres through Prisma, hosted on Neon. I split it
into an `Image` table and a `ValidationResult` table on purpose -- so for
every photo, I've got a row per rule that actually ran, which means I can
always answer "why was this rejected" by querying the data, instead of
having to dig through logs.

---

## 3. Decisions and tradeoffs (4-5 min)

This is the part I want to spend real time on, because a lot of these
choices came from hitting actual problems, not just picking what sounded
best on paper.

**📂 OPEN:** `server/src/queue/imageProcessingQueue.ts` — the
`MAX_CONCURRENCY` queue and the comment above it

So originally I built this with Redis and a proper job queue library
called BullMQ, mainly for durability and so it could scale across multiple
servers. I ended up ripping that out and replacing it with a simple
in-memory queue that just runs inside the one server process. The tradeoff
is real -- if the process crashes, whatever was mid-upload is just gone,
and it can't scale past a single instance without bringing something like
Redis back. But for what this needs to do right now, it removes a whole
piece of infrastructure, and that felt like the right call.

**📂 OPEN:** `server/src/services/storageService.ts` — the comment on
`getPublicObjectUrl`

Storage ended up being local disk instead of S3, and that one's basically a
story about infrastructure friction rather than a clean design choice. I
tried MinIO through Docker first, and that got blocked by a corporate
registry policy. Then I tried Backblaze, which was blocked by org policy on
that network. Then Cloudflare R2, which wanted a payment method just to
turn the free tier on. At some point I decided that wasn't worth fighting
anymore, so I fell back to local disk behind the same interface the S3
version used -- the validation pipeline doesn't know or care which one it's
talking to, so swapping in real S3 later only touches this one file.

**📂 OPEN:** `server/.env.example` — `DATABASE_URL`

Same story with the database, actually -- Postgres is real, it's just
hosted on Neon instead of running locally in Docker, for the exact same
reason. Neon gave me a working database in about two minutes with zero
fighting.

**📂 OPEN:** `server/src/validation/rules/faceSizeRule.ts` — the comment on
`evaluateFaceSizeRule`

One rule I want to call out specifically: if zero faces are detected, I
treat that as a pass, not a failure, for both the "face too small" and
"multiple faces" checks. The spec says reject a face that's too small or
reject if there's more than one -- it doesn't say every photo has to
contain a face at all, so I read it literally rather than adding a
requirement that wasn't actually there.

**📂 OPEN:** `server/src/validation/pipeline.ts` — `withDuplicateCheckLock`

There's also a small race condition I specifically guarded against -- if
two nearly-identical photos get uploaded at almost the same moment, they
could both check "is there a duplicate of me" before either one is saved,
and both would say no and both get accepted. This lock makes sure the
second one always sees the first one's result before it decides.

**📂 OPEN:** `server/src/validation/rules/formatRule.ts`

And quickly on security -- formats are verified by actual file content on
the server too, never just trusting what the client says. There's also a
guard against decompression-bomb-style files, and EXIF data gets stripped
from everything that's stored.

---

## 4. QA -- do this live (5-6 min)

**📂 OPEN:** the app at `localhost:5173`, and `demo-assets/` in Finder

Now let me actually run through it. I'll drag these in one at a time and
just talk through what happens as each one resolves.

1. `1-valid-accepted.jpg` → **Accepted**.
2. `2-duplicate-rejected.jpg` (same image again) → **Rejected, too similar**.
3. `3-blurry-rejected.jpg` → **Rejected, blurry**.
4. `4-too-small-rejected.jpg` → **Rejected, resolution too small**.
5. `5-wrong-format.gif` → blocked *before it even uploads* -- worth pointing
   out that this one's a different failure mode, it's the client catching
   it, not the server.
6. `6-solo-face-accepted.jpg` → **Accepted**.
7. `7-multiple-faces-rejected.jpg` → **Rejected, multiple faces**.
8. `8-face-too-small-rejected.jpg` → **Rejected, face too small**.

(Say briefly: these three face images are AI-generated synthetic faces, not
real people, made specifically for testing this.)

**Now the blur false positive -- worth doing on purpose:**

If you've got a real photo of yourself with a plain, softly-lit background
-- like a simple headshot -- upload that too and let it get flagged as
blurry even though it clearly isn't.

**📂 OPEN:** `server/src/services/blurService.ts` (same file from section 2)
— read the limitation comment on screen

So this is something I actually found while testing, not something I'm
guessing at. I ran the numbers: a sharp studio-style portrait with a smooth
background scored 27.65 on my blur metric, and an actually motion-blurred
photo scored 40.03 -- higher. So the blurry one scored better than the
sharp one, which means there's no threshold I could set that gets both of
those right at the same time. I tried a couple of fixes -- measuring
sharpness just on the face region, and normalizing by the image's own
contrast -- and neither one reliably solved it. I left the behavior
conservative on purpose, because letting an actually blurry photo through
felt worse than occasionally rejecting a sharp photo that just happens to
have very little texture in it. A real fix would probably need frequency
analysis or a trained model, and that's more than I could responsibly build
and validate in the time I had.

Then also show, quickly:
- Hovering over a rejected photo -- the tooltip with the specific reason.
- Deleting a photo -- it disappears right away.
- Refreshing the page -- everything's still there, because it's actually
  sitting in Postgres, not just held in memory in the browser.

---

## 5. Wrap-up (1 min)

Given how much time the infrastructure problems ate into, I made the call
to prioritize having a real, working system over having every test passing
green. There are a couple of unit test files that still reference function
signatures from before I switched the storage backend, and a couple of
dependencies in package.json that aren't actually used anymore -- both of
those are called out in the README, and they're small, contained cleanup,
not open design questions.
