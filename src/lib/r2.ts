import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  // Zamezení odesílání checksumů, které R2 u přesprezentovaných/signed URL u PUT ne vždy podporuje
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const BUCKET_NAME = process.env.R2_BUCKET || "karacho-media";
export const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
