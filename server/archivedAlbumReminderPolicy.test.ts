import { describe, expect, it } from "vitest";
import { shouldCreateArchivedAlbumReminder } from "./archivedAlbumReminderPolicy";

describe("archived album reminder policy", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");

  it("reminds only an archived album that has not been opened for more than six months", () => {
    expect(shouldCreateArchivedAlbumReminder({ isArchived: true, lastAccessedAt: new Date("2026-02-14T23:59:59.000Z"), lastInactivityReminderAt: null }, true, now)).toBe(true);
    expect(shouldCreateArchivedAlbumReminder({ isArchived: true, lastAccessedAt: new Date("2026-02-15T00:00:00.000Z"), lastInactivityReminderAt: null }, true, now)).toBe(false);
    expect(shouldCreateArchivedAlbumReminder({ isArchived: false, lastAccessedAt: new Date("2025-01-01T00:00:00.000Z"), lastInactivityReminderAt: null }, true, now)).toBe(false);
  });

  it("respects preference and suppresses duplicate reminders inside the guard interval", () => {
    const inactive = { isArchived: true, lastAccessedAt: new Date("2025-12-01T00:00:00.000Z"), lastInactivityReminderAt: null };
    expect(shouldCreateArchivedAlbumReminder(inactive, false, now)).toBe(false);
    expect(shouldCreateArchivedAlbumReminder({ ...inactive, lastInactivityReminderAt: new Date("2026-08-01T00:00:00.000Z") }, true, now)).toBe(false);
    expect(shouldCreateArchivedAlbumReminder({ ...inactive, lastInactivityReminderAt: new Date("2026-02-14T00:00:00.000Z") }, true, now)).toBe(true);
  });
});
