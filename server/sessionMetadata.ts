import { randomUUID } from "node:crypto";
import type { Request } from "express";
import * as db from "./db";

type GeoResponse = { success?: boolean; city?: string; country?: string };

export function describeDevice(userAgent: string | undefined) {
  const ua = userAgent ?? "";
  const platform = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Macintosh|Mac OS X/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Perangkat tidak dikenal";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /CriOS|Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Browser";
  return `${platform} · ${browser}`;
}

export function isPublicIp(value: string | undefined) {
  if (!value) return false;
  const ip = value.trim();
  if (ip.includes(":")) return !/^(::1|fc|fd|fe80)/i.test(ip);
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return !(parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
}

export function formatCoarseLocation(value: GeoResponse) {
  const pieces = [value.city?.trim(), value.country?.trim()].filter((item): item is string => Boolean(item));
  return pieces.length ? pieces.join(", ") : "Lokasi jaringan tidak tersedia";
}

function getForwardedIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() ?? (typeof req.headers["x-real-ip"] === "string" ? req.headers["x-real-ip"] : undefined);
}

export async function resolveCoarseLocation(req: Request) {
  const ip = getForwardedIp(req);
  if (!isPublicIp(ip)) return "Lokasi jaringan tidak tersedia";
  const publicIp = ip as string;
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(publicIp)}`, { signal: AbortSignal.timeout(1_500), headers: { Accept: "application/json" } });
    if (!response.ok) return "Lokasi jaringan tidak tersedia";
    return formatCoarseLocation(await response.json() as GeoResponse);
  } catch {
    return "Lokasi jaringan tidak tersedia";
  }
}

export async function registerActiveSession(userId: number, sessionVersion: number, req: Request) {
  const id = randomUUID();
  await db.createUserActiveSession({ id, userId, sessionVersion, deviceLabel: describeDevice(req.headers["user-agent"]), locationLabel: await resolveCoarseLocation(req) });
  return id;
}
