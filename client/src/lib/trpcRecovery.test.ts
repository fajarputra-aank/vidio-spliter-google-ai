import { describe, expect, it } from "vitest";
import { isTemporaryTrpcTransportError } from "./trpcRecovery";

describe("isTemporaryTrpcTransportError", () => {
  it("mengenali hanya fallback transport tRPC yang terstruktur", () => {
    expect(isTemporaryTrpcTransportError({ message: "Layanan sementara sedang menyegarkan. Silakan coba lagi.", data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 } })).toBe(true);
    expect(isTemporaryTrpcTransportError({ message: "Kata sandi salah", data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(false);
  });
});
