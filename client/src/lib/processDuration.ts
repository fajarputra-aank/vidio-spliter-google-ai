export function formatProcessDuration(startedAt: Date | string, endedAt?: Date | string | null) {
  if (!endedAt) return "Masih berlangsung";
  const seconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} mnt${seconds % 60 ? ` ${seconds % 60} dtk` : ""}`;
}
