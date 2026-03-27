import { useMemo } from "react";

const STORAGE_KEY = "timeZoneId";

function normalizeUtcIso(iso: string): string {
  return !iso.endsWith("Z") && !iso.includes("+") ? `${iso}Z` : iso;
}

export function useTimezone() {
  const timeZoneId = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored;
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }, []);

  function toLocal(utcDate: string, options?: Intl.DateTimeFormatOptions): string {
    const date = new Date(normalizeUtcIso(utcDate));
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      ...options,
      timeZone: timeZoneId,
    }).format(date);
  }

  function toUtc(localDate: string | Date): string {
    const date = localDate instanceof Date ? localDate : new Date(localDate);
    return date.toISOString();
  }

  return { timeZoneId, toLocal, toUtc };
}
