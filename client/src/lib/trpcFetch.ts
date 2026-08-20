const JSON_CONTENT_TYPE = "application/json";
type TrpcTransportMetric = { operationGroup: "auth" | "brand" | "other"; responseKind: "html" | "text" | "empty" | "other"; statusClass: number };

function isJsonResponse(response: Response) { return response.headers.get("content-type")?.toLowerCase().includes(JSON_CONTENT_TYPE) ?? false; }

function transportErrorResponse(status: number) {
  return new Response(JSON.stringify([{ error: { json: { message: "Layanan sementara sedang menyegarkan. Silakan coba lagi.", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: status } } } }]), { status: 200, headers: { "content-type": "application/json" } });
}

function metricFor(input: RequestInfo | URL, response: Response): TrpcTransportMetric {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  const operationGroup = url.includes("auth.") ? "auth" : url.includes("brand.") ? "brand" : "other";
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const responseKind = contentType.includes("text/html") ? "html" : contentType.includes("text/plain") ? "text" : contentType.length === 0 ? "empty" : "other";
  return { operationGroup, responseKind, statusClass: response.status > 0 ? Math.min(5, Math.floor(response.status / 100)) : 0 };
}

function reportTrpcTransportMetric(metric: TrpcTransportMetric) {
  void globalThis.fetch("/api/client-metrics/trpc-non-json", { method: "POST", headers: { "content-type": "application/json" }, credentials: "omit", keepalive: true, body: JSON.stringify(metric) }).catch(() => undefined);
}

/** Preserve session cookies, retry temporary non-JSON responses, and report only aggregate transport categories. */
export function createSafeTrpcFetch(baseFetch: typeof fetch = globalThis.fetch, reportMetric: (metric: TrpcTransportMetric) => void = reportTrpcTransportMetric): typeof fetch {
  return async (input, init) => {
    const requestInit: RequestInit = { ...(init ?? {}), credentials: "include" };
    let response = await baseFetch(input, requestInit);
    if (isJsonResponse(response)) return response;
    reportMetric(metricFor(input, response));
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 120));
    response = await baseFetch(input, requestInit);
    if (isJsonResponse(response)) return response;
    return transportErrorResponse(response.status >= 400 ? response.status : 503);
  };
}
