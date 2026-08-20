type ErrorShape = { message?: unknown; data?: { code?: unknown; httpStatus?: unknown } };

/** Match only the structured fallback emitted by the tRPC transport guard. */
export function isTemporaryTrpcTransportError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as ErrorShape;
  return value.message === "Layanan sementara sedang menyegarkan. Silakan coba lagi." && value.data?.code === "INTERNAL_SERVER_ERROR" && value.data?.httpStatus === 503;
}
