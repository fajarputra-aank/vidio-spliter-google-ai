import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), getScheduledJobByTaskUid: vi.fn(), listAutomaticSecuritySummaryRecipients: vi.fn(), claimSecuritySummaryPeriod: vi.fn(), listRecentUserSecurityEvents: vi.fn(), sendSecuritySummaryEmail: vi.fn() }));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getScheduledJobByTaskUid: mocks.getScheduledJobByTaskUid, listAutomaticSecuritySummaryRecipients: mocks.listAutomaticSecuritySummaryRecipients, claimSecuritySummaryPeriod: mocks.claimSecuritySummaryPeriod, listRecentUserSecurityEvents: mocks.listRecentUserSecurityEvents }));
vi.mock("./accountEmails", () => ({ sendSecuritySummaryEmail: mocks.sendSecuritySummaryEmail }));

import { handleSecuritySummaries } from "./scheduled/securitySummaries";

function response() { const result = { status: vi.fn(), json: vi.fn() }; result.status.mockReturnValue(result); return result; }

describe("security summary callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only once for a registered central cron task", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "digest-task" });
    mocks.getScheduledJobByTaskUid.mockResolvedValue({ name: "security-summary-sweep", taskUid: "digest-task" });
    mocks.listAutomaticSecuritySummaryRecipients.mockResolvedValue([{ userId: 88, email: "security@example.com", frequency: "daily" }]);
    mocks.claimSecuritySummaryPeriod.mockResolvedValue(true);
    mocks.listRecentUserSecurityEvents.mockResolvedValue([{ kind: "login", createdAt: new Date() }]);
    mocks.sendSecuritySummaryEmail.mockResolvedValue(true);
    const res = response();
    await handleSecuritySummaries({ path: "/api/scheduled/security-summaries" } as never, res as never);
    expect(mocks.claimSecuritySummaryPeriod).toHaveBeenCalledWith(88, expect.stringMatching(/^daily-/), expect.any(Date));
    expect(mocks.sendSecuritySummaryEmail).toHaveBeenCalledWith({ email: "security@example.com" }, expect.any(Array));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, checked: 1, sent: 1 }));
  });

  it("does not run for a regular browser session or a duplicate period claim", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const blocked = response();
    await handleSecuritySummaries({ path: "/api/scheduled/security-summaries" } as never, blocked as never);
    expect(blocked.status).toHaveBeenCalledWith(403);
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "digest-task" });
    mocks.getScheduledJobByTaskUid.mockResolvedValue({ name: "security-summary-sweep" });
    mocks.listAutomaticSecuritySummaryRecipients.mockResolvedValue([{ userId: 88, email: "security@example.com", frequency: "weekly" }]);
    mocks.claimSecuritySummaryPeriod.mockResolvedValue(false);
    const duplicate = response();
    await handleSecuritySummaries({ path: "/api/scheduled/security-summaries" } as never, duplicate as never);
    expect(mocks.sendSecuritySummaryEmail).not.toHaveBeenCalled();
    expect(duplicate.json).toHaveBeenCalledWith(expect.objectContaining({ sent: 0, skipped: 1 }));
  });
});
