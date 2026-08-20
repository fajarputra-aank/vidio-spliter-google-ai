import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getTrpcTransportMetricTrend: vi.fn() }));
vi.mock("./db", () => ({ getTrpcTransportMetricTrend: mocks.getTrpcTransportMetricTrend }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 1, openId: "transport-test", name: "Transport Test", email: "transport@test.local", loginMethod: "password", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin tRPC transport trend", () => {
  beforeEach(() => {
    mocks.getTrpcTransportMetricTrend.mockReset();
  });

  it("returns only the prepared aggregate trend for an administrator", async () => {
    mocks.getTrpcTransportMetricTrend.mockResolvedValue({ totalOccurrences: 3, byOperationGroup: [{ operationGroup: "auth", occurrences: 3 }], byResponseKind: [{ responseKind: "html", occurrences: 3 }], hourly: [], rangeStartedAt: new Date(), rangeEndedAt: new Date(), lastObservedAt: new Date() });
    await expect(appRouter.createCaller(context("admin")).admin.trpcTransportTrend()).resolves.toMatchObject({ totalOccurrences: 3, byOperationGroup: [{ operationGroup: "auth", occurrences: 3 }] });
    expect(mocks.getTrpcTransportMetricTrend).toHaveBeenCalledOnce();
  });

  it("rejects regular users before aggregate metrics are read", async () => {
    await expect(appRouter.createCaller(context("user")).admin.trpcTransportTrend()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getTrpcTransportMetricTrend).not.toHaveBeenCalled();
  });
});
