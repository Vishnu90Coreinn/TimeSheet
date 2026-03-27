import { useEffect, useMemo } from "react";

const STORAGE_KEY = "timeZoneId";

const WINDOWS_TO_IANA: Record<string, string> = {
  "AUS Central Standard Time": "Australia/Darwin",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "Alaskan Standard Time": "America/Anchorage",
  "Arab Standard Time": "Asia/Riyadh",
  "Atlantic Standard Time": "America/Halifax",
  "Cen. Australia Standard Time": "Australia/Adelaide",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central Standard Time": "America/Chicago",
  "China Standard Time": "Asia/Shanghai",
  "E. Australia Standard Time": "Australia/Brisbane",
  "Eastern Standard Time": "America/New_York",
  "GMT Standard Time": "Europe/London",
  "India Standard Time": "Asia/Kolkata",
  "Mountain Standard Time": "America/Denver",
  "New Zealand Standard Time": "Pacific/Auckland",
  "Pacific Standard Time": "America/Los_Angeles",
  "Romance Standard Time": "Europe/Paris",
  "Singapore Standard Time": "Asia/Singapore",
  "Tokyo Standard Time": "Asia/Tokyo",
  "W. Australia Standard Time": "Australia/Perth",
  "W. Europe Standard Time": "Europe/Berlin",
};

function normalizeUtcIso(iso: string): string {
  return !iso.endsWith("Z") && !iso.includes("+") ? `${iso}Z` : iso;
}

function isSupportedTimeZone(timeZoneId: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timeZoneId }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZoneId(timeZoneId: string | null | undefined): string {
  const trimmed = timeZoneId?.trim();
  if (!trimmed) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  const mapped = WINDOWS_TO_IANA[trimmed] ?? trimmed;
  if (isSupportedTimeZone(mapped)) return mapped;

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isSupportedTimeZone(detected) ? detected : "UTC";
}

export function useTimezone() {
  const timeZoneId = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeTimeZoneId(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, timeZoneId);
  }, [timeZoneId]);

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
