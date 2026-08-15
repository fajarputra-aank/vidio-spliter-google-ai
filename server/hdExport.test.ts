import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ consumeHdExportCredit: vi.fn() }));
vi.mock("./db", () => ({ consumeHdExportCredit: mocks.consumeHdExportCredit }));
import { appRouter } from "./routers";

function userContext(): TrpcContext {
  return { user: { id: 8, openId: "hd-user", name: "HD User", email: "hd@test.local", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("HD export credits", () => {
  it("returns the owned completed result after charging the explicit HD export credit", async () => {
    mocks.consumeHdExportCredit.mockResolvedValue({ ok: true, resultUrl: "https://example.test/hd.png" });
    const result = await appRouter.createCaller(userContext()).photo.hdExport({ transformId: 90 });
    expect(mocks.consumeHdExportCredit).toHaveBeenCalledWith(8, 90);
    expect(result).toEqual({ resultUrl: "https://example.test/hd.png", charged: true });
  });

  it("rejects an HD export when the user has no paid credit", async () => {
    mocks.consumeHdExportCredit.mockResolvedValue({ ok: false, reason: "no_credit" });
    await expect(appRouter.createCaller(userContext()).photo.hdExport({ transformId: 90 })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
