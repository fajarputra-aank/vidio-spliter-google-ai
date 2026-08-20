import { describe, expect, it, vi } from "vitest";
import { createSafeTrpcFetch } from "./trpcFetch";

describe("createSafeTrpcFetch", () => {
  it("mencoba ulang respons HTML sementara sebelum meneruskannya ke parser tRPC", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("<html>memuat</html>", { status: 200, headers: { "content-type": "text/html" } })).mockResolvedValueOnce(new Response('[{"result":{"data":{"json":null}}}]', { status: 200, headers: { "content-type": "application/json" } }));
    const reportMetric = vi.fn(); const response = await createSafeTrpcFetch(fetchMock as unknown as typeof fetch, reportMetric)("/api/trpc/auth.me", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(await response.json()).toEqual([{ result: { data: { json: null } } }]); expect(fetchMock).toHaveBeenLastCalledWith("/api/trpc/auth.me", expect.objectContaining({ credentials: "include" })); expect(reportMetric).toHaveBeenCalledWith({ operationGroup: "auth", responseKind: "html", statusClass: 2 });
  });

  it("memberi tahu indikator studio ketika fallback dipulihkan oleh percobaan ulang", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("<html>memuat</html>", { status: 503, headers: { "content-type": "text/html" } })).mockResolvedValueOnce(new Response('[{"result":{"data":{"json":null}}}]', { status: 200, headers: { "content-type": "application/json" } }));
    const callbacks = { onFallback: vi.fn(), onRecovered: vi.fn() };
    await createSafeTrpcFetch(fetchMock as unknown as typeof fetch, vi.fn(), callbacks)("/api/trpc/photo.list", { method: "GET" });
    expect(callbacks.onFallback).toHaveBeenCalledOnce();
    expect(callbacks.onRecovered).toHaveBeenCalledOnce();
  });

  it("mengembalikan error tRPC terstruktur jika dua respons berturut-turut bukan JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>fallback</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const reportMetric = vi.fn(); const response = await createSafeTrpcFetch(fetchMock as unknown as typeof fetch, reportMetric)("/api/trpc/auth.me", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(reportMetric).toHaveBeenCalledTimes(1); await expect(response.json()).resolves.toMatchObject([{ error: { json: { message: "Layanan sementara sedang menyegarkan. Silakan coba lagi.", data: { httpStatus: 503 } } } }]);
  });
});
