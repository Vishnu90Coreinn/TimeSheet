import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";

const STORAGE_KEY = "timeZoneId";

function normalizeUtcIso(iso: string): string {
  return !iso.endsWith("Z") && !iso.includes("+") ? `${iso}Z` : iso;
}

function getStoredTimezone(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored.trim() ? stored : null;
}

export function useTimezone() {
  const [timeZoneId, setTimeZoneId] = useState<string>(() => getStoredTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  useEffect(() => {
    const stored = getStoredTimezone();
    if (stored) {
      if (stored !== timeZoneId) setTimeZoneId(stored);
      return;
    }

    let isMounted = true;

    (async () => {
      const response = await apiFetch("/profile").catch(() => null);
      if (!response?.ok) return;

      const profile = await response.json().catch(() => null) as { timeZoneId?: string } | null;
      const profileZone = profile?.timeZoneId?.trim();
      if (!isMounted || !profileZone) return;

      localStorage.setItem(STORAGE_KEY, profileZone);
      setTimeZoneId(profileZone);
    })();

    return () => {
      isMounted = false;
    };
  }, [timeZoneId]);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZoneId,
  }), [timeZoneId]);

  function toLocal(utcDate: string, options?: Intl.DateTimeFormatOptions): string {
    const date = new Date(normalizeUtcIso(utcDate));
    if (!options) return dateFormatter.format(date);

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
