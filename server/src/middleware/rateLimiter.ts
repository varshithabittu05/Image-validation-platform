import rateLimit from "express-rate-limit";

// Uploads are the only endpoint that costs real resources (storage write +
// a queued processing job), so it gets a dedicated, tighter limit rather
// than sharing a blanket limit with cheap read endpoints.
export const uploadRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please wait a moment before trying again." },
});
