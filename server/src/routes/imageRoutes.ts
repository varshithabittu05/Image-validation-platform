import { Router } from "express";
import { getImage, getImages, removeImage, uploadImage } from "../controllers/imageController";
import { uploadMiddleware } from "../middleware/upload";
import { uploadRateLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";

export const imageRoutes = Router();

imageRoutes.post("/", uploadRateLimiter, uploadMiddleware, asyncHandler(uploadImage));
imageRoutes.get("/", asyncHandler(getImages));
imageRoutes.get("/:id", asyncHandler(getImage));
imageRoutes.delete("/:id", asyncHandler(removeImage));
 