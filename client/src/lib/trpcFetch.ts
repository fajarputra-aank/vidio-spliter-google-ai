const JSON_CONTENT_TYPE = "application/json";

function isJsonResponse(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes(JSON_CONTENT_TYPE) ?? false;
}

function transportErrorResponse(status: number) {
  return new Response(JSON.stringify([{ error: { json: { message: "Layanan sementara sedang menyegarkan. Silakan coba lagi.", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: status } } } }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Preserve session cookies and prevent a temporary HTML/proxy response from
 * reaching the tRPC JSON parser during dev-server restarts or edge retries.
 */
export function createSafeTrpcFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    const requestInit: RequestInit = { ...(init ?? {}), credentials: "include" };
    let response = await baseFetch(input, requestInit);
    if (isJsonResponse(response)) return response;

    // A short retry absorbs transient proxy/Vite fallback responses without retrying valid JSON API errors.
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 120));
    response = await baseFetch(input, requestInit);
    if (isJsonResponse(response)) return response;

    return transportErrorResponse(response.status >= 400 ? response.status : 503);
  };
}
