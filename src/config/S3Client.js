import { S3Client } from "@aws-sdk/client-s3";
import { API_CONFIG } from "./ApiEndpoints.js";

export const s3Client = new S3Client({
    region: API_CONFIG.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: API_CONFIG.AWS_ACCESS_KEY_ID,
        secretAccessKey: API_CONFIG.AWS_SECRET_ACCESS_KEY,
    },
    endpoint: API_CONFIG.AWS_ENDPOINT || undefined, // optional if using custom endpoint
});
