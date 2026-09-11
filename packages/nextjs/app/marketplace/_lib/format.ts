export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Formats a unix-seconds timestamp as a short relative time, e.g. "in 3h" or "2h ago". */
export function formatRelativeTime(unixSeconds: bigint | number): string {
  const targetMs = Number(unixSeconds) * 1000;
  const diffMs = targetMs - Date.now();
  const future = diffMs >= 0;
  const diffSeconds = Math.round(Math.abs(diffMs) / 1000);

  const units: [string, number][] = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];

  for (const [label, secondsInUnit] of units) {
    if (diffSeconds >= secondsInUnit) {
      const value = Math.floor(diffSeconds / secondsInUnit);
      return future ? `in ${value}${label}` : `${value}${label} ago`;
    }
  }

  return future ? "in <1s" : "just now";
}

/** Formats a remaining-seconds duration as e.g. "9m 32s". Clamped to 0. */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
