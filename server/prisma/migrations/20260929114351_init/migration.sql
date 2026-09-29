-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidationRule" AS ENUM ('FORMAT', 'RESOLUTION', 'DUPLICATE', 'BLUR', 'FACE_SIZE', 'MULTIPLE_FACES');

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalStorageKey" TEXT NOT NULL,
    "processedStorageKey" TEXT,
    "thumbnailStorageKey" TEXT,
    "perceptualHash" BIT(64),
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "rule" "ValidationRule" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_status_createdAt_id_idx" ON "Image"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Image_sourceId_idx" ON "Image"("sourceId");

-- CreateIndex
CREATE INDEX "Image_perceptualHash_idx" ON "Image"("perceptualHash");

-- CreateIndex
CREATE INDEX "ValidationResult_imageId_idx" ON "ValidationResult"("imageId");

-- CreateIndex
CREATE INDEX "ValidationResult_rule_passed_idx" ON "ValidationResult"("rule", "passed");

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
