import { storagePut } from "../storage";
import { ENV } from "./env";

const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{ url?: string; b64Json?: string; mimeType?: string }>;
  model?: string;
  quality?: string;
  signal?: AbortSignal;
};

export type GenerateImageResponse = { url?: string };

function mimeExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

function openAiSize() {
  const size = process.env.OPENAI_IMAGE_SIZE;
  return size === "1024x1536" || size === "1536x1024" || size === "auto" ? size : "1024x1024";
}

async function sourceToBuffer(source: { url?: string; b64Json?: string }, signal?: AbortSignal) {
  if (source.b64Json) return Buffer.from(source.b64Json.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!source.url) throw new Error("Sumber gambar AI tidak tersedia.");
  const response = await fetch(source.url, { signal });
  if (!response.ok) throw new Error(`Sumber gambar AI gagal diunduh (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function generateWithOpenAi(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi.");
  const model = options.model && !options.model.startsWith("MODEL_") ? options.model : ENV.openAiImageModel;
  const sources = options.originalImages ?? [];
  let response: Response;

  if (sources.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", options.prompt);
    form.append("size", openAiSize());
    if (options.quality) form.append("quality", options.quality);
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      const mimeType = source.mimeType ?? "image/jpeg";
      const buffer = await sourceToBuffer(source, options.signal);
      form.append("image[]", new Blob([buffer], { type: mimeType }), `source-${index}.${mimeExtension(mimeType)}`);
    }
    response = await fetch(`${ENV.openAiBaseUrl}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${ENV.openAiApiKey}` }, body: form, signal: options.signal });
  } else {
    response = await fetch(`${ENV.openAiBaseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: options.prompt, size: openAiSize(), quality: options.quality ?? "auto", response_format: "b64_json" }),
      signal: options.signal,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI image request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }
  const result = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = result.data?.[0];
  if (!image) throw new Error("OpenAI tidak mengembalikan gambar hasil.");
  if (image.url) return { url: image.url };
  if (!image.b64_json) throw new Error("OpenAI tidak mengembalikan data gambar.");
  const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(image.b64_json, "base64"), "image/png");
  return { url: stored.url };
}

async function generateWithManus(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) throw new Error("BUILT_IN_FORGE_API_URL belum dikonfigurasi.");
  if (!ENV.forgeApiKey) throw new Error("BUILT_IN_FORGE_API_KEY belum dikonfigurasi.");
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const response = await fetch(new URL("images.v1.ImageService/GenerateImage", baseUrl), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "connect-protocol-version": "1", authorization: `Bearer ${ENV.forgeApiKey}` },
    body: JSON.stringify({ prompt: options.prompt, original_images: options.originalImages || [], model: options.model ?? DEFAULT_IMAGE_MODEL, ...(options.quality ?? (options.model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined) ? { quality: options.quality ?? DEFAULT_IMAGE_QUALITY } : {}) }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Image generation request failed (${response.status} ${response.statusText})${await response.text().catch(() => "")}`);
  const result = (await response.json()) as { image: { b64Json: string; mimeType: string } };
  const stored = await storagePut(`generated/${Date.now()}.png`, Buffer.from(result.image.b64Json, "base64"), result.image.mimeType);
  return { url: stored.url };
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  return ENV.aiProvider === "openai" ? generateWithOpenAi(options) : generateWithManus(options);
}

export type ImageModelInfo = { model?: string; id?: string };
export type ListImageModelsResponse = { models: ImageModelInfo[] };

export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (ENV.aiProvider === "openai") return { models: [{ model: ENV.openAiImageModel, id: ENV.openAiImageModel }] };
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Konfigurasi provider AI Manus belum lengkap.");
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const response = await fetch(new URL("images.v1.ImageService/ListModels", baseUrl), { method: "POST", headers: { accept: "application/json", "content-type": "application/json", "connect-protocol-version": "1", authorization: `Bearer ${ENV.forgeApiKey}` }, body: "{}" });
  if (!response.ok) throw new Error(`List image models failed (${response.status} ${response.statusText})`);
  const result = (await response.json()) as { models?: ImageModelInfo[] };
  return { models: result.models ?? [] };
}
