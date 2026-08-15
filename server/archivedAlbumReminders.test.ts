import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getScheduledJobByTaskUid: vi.fn(),
  runArchivedAlbumReminderSweep: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getScheduledJobByTaskUid: mocks.getScheduledJobByTaskUid, runArchivedAlbumReminderSweep: mocks.runArchivedAlbumReminderSweep }));

import { handleArchivedAlbumReminders } from "./scheduled/archivedAlbumReminders";

function response() {
  const result = { status: vi.fn(), json: vi.fn() };
  result.status.mockReturnValue(result);
  return result;
}

describe("archived album reminder callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs only for the registered cron task and returns its idempotent sweep summary", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    mocks.getScheduledJobByTaskUid.mockResolvedValue({ name: "archived-album-reminders", taskUid: "task-1" });
    mocks.runArchivedAlbumReminderSweep.mockResolvedValue({ checked: 4, reminded: 1 });
    const res = response();
    await handleArchivedAlbumReminders({ path: "/api/scheduled/archived-album-reminders" } as never, res as never);
    expect(mocks.getScheduledJobByTaskUid).toHaveBeenCalledWith("task-1");
    expect(mocks.runArchivedAlbumReminderSweep).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ ok: true, checked: 4, reminded: 1 });
  });

  it("rejects regular browser sessions", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await handleArchivedAlbumReminders({ path: "/api/scheduled/archived-album-reminders" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.runArchivedAlbumReminderSweep).not.toHaveBeenCalled();
  });
});
