export type ArchivedAlbumReminderCandidate = {
  isArchived: boolean;
  lastAccessedAt: Date;
  lastInactivityReminderAt: Date | null;
};

export function shouldCreateArchivedAlbumReminder(candidate: ArchivedAlbumReminderCandidate, accountActivityEnabled: boolean, now = new Date()) {
  if (!candidate.isArchived || !accountActivityEnabled) return false;
  const threshold = new Date(now);
  threshold.setUTCMonth(threshold.getUTCMonth() - 6);
  if (candidate.lastAccessedAt >= threshold) return false;
  if (candidate.lastInactivityReminderAt && candidate.lastInactivityReminderAt >= threshold) return false;
  return true;
}
