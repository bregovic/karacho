import { S3Client } from "@aws-sdk/client-s3";

// Funkce pro bezpečné získání proměnné (odstraní případné uvozovky z Railway)
const cleanEnv = (key: string) => process.env[key]?.replace(/["]/g, '').trim();

export const r2 = new S3Client({
  region: "auto",
  endpoint: cleanEnv("R2_ENDPOINT")!,
  credentials: {
    accessKeyId: cleanEnv("R2_ACCESS_KEY_ID")!,
    secretAccessKey: cleanEnv("R2_SECRET_ACCESS_KEY")!,
  },
  forcePathStyle: true, // Pro nahrávání ze serveru (proxy) je toto nejstabilnější
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const BUCKET_NAME = cleanEnv("R2_BUCKET") || "karacho-media";
export const PUBLIC_URL = cleanEnv("R2_PUBLIC_URL") || "";
