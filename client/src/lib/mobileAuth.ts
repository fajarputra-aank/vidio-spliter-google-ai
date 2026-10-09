import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type MobileAuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
};

const MOBILE_TOKENS_KEY = "lensa_saku_mobile_tokens";

export function isNativeMobile() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  return configured || (isNativeMobile() ? "http://10.0.2.2:3000" : "");
}

export async function getMobileTokens(): Promise<MobileAuthTokens | null> {
  if (!isNativeMobile()) return null;
  const stored = await Preferences.get({ key: MOBILE_TOKENS_KEY });
  if (!stored.value) return null;
  try {
    const parsed = JSON.parse(stored.value) as MobileAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.sessionId) return null;
    return parsed;
  } catch {
    await clearMobileTokens();
    return null;
  }
}

export async function saveMobileTokens(tokens: MobileAuthTokens) {
  if (!isNativeMobile()) return;
  await Preferences.set({ key: MOBILE_TOKENS_KEY, value: JSON.stringify(tokens) });
}

export async function clearMobileTokens() {
  if (!isNativeMobile()) return;
  await Preferences.remove({ key: MOBILE_TOKENS_KEY });
}

let refreshInFlight: Promise<MobileAuthTokens | null> | null = null;

export async function refreshMobileTokens() {
  if (!isNativeMobile()) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = await getMobileTokens();
    if (!current) return null;
    const response = await globalThis.fetch(`${getApiBaseUrl()}/api/trpc/auth.mobileRefresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ "0": { json: { refreshToken: current.refreshToken } } }),
    });
    if (!response.ok) {
      await clearMobileTokens();
      return null;
    }
    const payload = (await response.json()) as Array<{ result?: { data?: { json?: MobileAuthTokens } } }>;
    const tokens = payload[0]?.result?.data?.json;
    if (!tokens?.accessToken || !tokens.refreshToken) {
      await clearMobileTokens();
      return null;
    }
    await saveMobileTokens(tokens);
    return tokens;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function ensureFreshAccessToken() {
  const tokens = await getMobileTokens();
  if (!tokens) return null;
  if (Date.parse(tokens.accessTokenExpiresAt) - Date.now() > 30_000) return tokens;
  return refreshMobileTokens();
}

export const mobileTrpcFetch: typeof fetch = async (input, init) => {
  const tokens = await ensureFreshAccessToken();
  const headers = new Headers(init?.headers);
  if (tokens?.accessToken) headers.set("authorization", `Bearer ${tokens.accessToken}`);
  return globalThis.fetch(input, { ...(init ?? {}), headers, credentials: "omit" });
};
