export type AiProvider = "manus" | "openai";
export type StorageProvider = "manus" | "s3";

function readProvider<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  independentBackend: process.env.INDEPENDENT_BACKEND === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  aiProvider: readProvider(process.env.AI_PROVIDER, ["manus", "openai"] as const, "manus"),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
  openAiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  storageProvider: readProvider(process.env.STORAGE_PROVIDER, ["manus", "s3"] as const, "manus"),
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};

export function assertIndependentBackendConfig() {
  const errors: string[] = [];
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) errors.push("JWT_SECRET minimal 32 karakter");
  if (!ENV.databaseUrl) errors.push("DATABASE_URL");
  if (ENV.aiProvider === "openai" && !ENV.openAiApiKey) errors.push("OPENAI_API_KEY");
  if (ENV.storageProvider === "s3") {
    if (!ENV.s3Bucket) errors.push("S3_BUCKET");
    if (!ENV.s3Region) errors.push("S3_REGION");
    if (!ENV.s3AccessKeyId) errors.push("S3_ACCESS_KEY_ID");
    if (!ENV.s3SecretAccessKey) errors.push("S3_SECRET_ACCESS_KEY");
  }
  if (errors.length) throw new Error(`Konfigurasi backend independen belum lengkap: ${errors.join(", ")}`);
}
