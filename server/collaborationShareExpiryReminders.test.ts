import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), getScheduledJobByTaskUid: vi.fn(), runPhotoCollaborationShareExpiryReminderSweep: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getScheduledJobByTaskUid: mocks.getScheduledJobByTaskUid, runPhotoCollaborationShareExpiryReminderSweep: mocks.runPhotoCollaborationShareExpiryReminderSweep }));
import { handleCollaborationShareExpiryReminders } from "./scheduled/collaborationShareExpiryReminders";

function response() { const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res; }
describe("pengingat kedaluwarsa tautan Kolaborasi Foto", () => {
  it("menolak pemanggil non-cron dan menjalankan sweep hanya untuk tugas yang terdaftar", async () => { const res = response(); mocks.authenticateRequest.mockResolvedValue({ isCron: false }); await handleCollaborationShareExpiryReminders({ path: "/api/scheduled/collaboration-share-expiry-reminders" } as never, res as never); expect(res.status).toHaveBeenCalledWith(403); mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" }); mocks.getScheduledJobByTaskUid.mockResolvedValue({ name: "collaboration-share-expiry-reminders" }); mocks.runPhotoCollaborationShareExpiryReminderSweep.mockResolvedValue({ notified: 2 }); const ok = response(); await handleCollaborationShareExpiryReminders({ path: "/api/scheduled/collaboration-share-expiry-reminders" } as never, ok as never); expect(mocks.getScheduledJobByTaskUid).toHaveBeenCalledWith("task-1"); expect(mocks.runPhotoCollaborationShareExpiryReminderSweep).toHaveBeenCalledOnce(); expect(ok.json).toHaveBeenCalledWith({ ok: true, notified: 2 }); });
});
