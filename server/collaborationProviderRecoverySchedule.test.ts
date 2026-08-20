import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), getScheduledJobByTaskUid: vi.fn(), run: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getScheduledJobByTaskUid: mocks.getScheduledJobByTaskUid }));
vi.mock("./collaborationProviderRecovery", () => ({ runCollaborationProviderRecoverySweep: mocks.run }));
import { handleCollaborationProviderRecovery } from "./scheduled/collaborationProviderRecovery";

function response() { const json = vi.fn(); const status = vi.fn(() => ({ json })); return { json, status }; }

describe("handleCollaborationProviderRecovery", () => {
  it("menolak sesi biasa dan hanya menjalankan sweep untuk tugas terdaftar", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: false });
    const denied = response(); await handleCollaborationProviderRecovery({ path: "/api/scheduled/collaboration-provider-recovery" } as never, denied as never);
    expect(denied.status).toHaveBeenCalledWith(403);
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "recovery-task" }); mocks.getScheduledJobByTaskUid.mockResolvedValueOnce({ name: "collaboration-provider-recovery" }); mocks.run.mockResolvedValueOnce({ checked: 1, completed: 1, deferred: 0, skipped: 0 });
    const ok = response(); await handleCollaborationProviderRecovery({ path: "/api/scheduled/collaboration-provider-recovery" } as never, ok as never);
    expect(mocks.getScheduledJobByTaskUid).toHaveBeenCalledWith("recovery-task"); expect(ok.json).toHaveBeenCalledWith({ ok: true, checked: 1, completed: 1, deferred: 0, skipped: 0 });
  });
});
