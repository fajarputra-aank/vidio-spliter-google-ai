import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { handleTrpcNonJsonMetric } from "./_core/trpcTransportMetrics";

function responseMock() {
  const response = { status: vi.fn(), end: vi.fn() };
  response.status.mockReturnValue(response); response.end.mockReturnValue(response);
  return response;
}

describe("handleTrpcNonJsonMetric", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyimpan bucket agregat tanpa input, cookie, URL, atau identitas pengguna", async () => {
    const onDuplicateKeyUpdate = vi.fn(); const values = vi.fn(() => ({ onDuplicateKeyUpdate })); const insert = vi.fn(() => ({ values }));
    mocks.getDb.mockResolvedValue({ insert }); const response = responseMock();
    await handleTrpcNonJsonMetric({ body: { operationGroup: "auth", responseKind: "html", statusClass: 2 } } as never, response as never);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ operationGroup: "auth", responseKind: "html", statusClass: 2, occurrences: 1 }));
    expect(values.mock.calls[0][0]).not.toHaveProperty("userId"); expect(values.mock.calls[0][0]).not.toHaveProperty("url"); expect(response.status).toHaveBeenCalledWith(204);
  });

  it("mengabaikan payload kategorikal yang tidak valid", async () => {
    const response = responseMock();
    await handleTrpcNonJsonMetric({ body: { operationGroup: "profile", responseKind: "html", statusClass: 2 } } as never, response as never);
    expect(mocks.getDb).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(204);
  });
});
