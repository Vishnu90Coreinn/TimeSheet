import { useCallback, useEffect, useState } from "react";
import { setOnSessionExpired, setTokens } from "../api/client";
import { apiFetch } from "../api/client";
import type { Session } from "../types";

const STORAGE_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  username: "username",
  role: "role",
  userId: "userId",
  onboardingCompletedAt: "onboardingCompletedAt",
  leaveWorkflowVisitedAt: "leaveWorkflowVisitedAt",
} as const;

function persistSession(session: Session) {
  localStorage.setItem(STORAGE_KEYS.accessToken, session.accessToken);
  localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken);
  localStorage.setItem(STORAGE_KEYS.username, session.username);
  localStorage.setItem(STORAGE_KEYS.role, session.role);
  localStorage.setItem(STORAGE_KEYS.userId, session.userId);
  if (session.onboardingCompletedAt) {
    localStorage.setItem(STORAGE_KEYS.onboardingCompletedAt, session.onboardingCompletedAt);
  } else {
    localStorage.removeItem(STORAGE_KEYS.onboardingCompletedAt);
  }
  if (session.leaveWorkflowVisitedAt) {
    localStorage.setItem(STORAGE_KEYS.leaveWorkflowVisitedAt, session.leaveWorkflowVisitedAt);
  } else {
    localStorage.removeItem(STORAGE_KEYS.leaveWorkflowVisitedAt);
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    if (session?.refreshToken) {
      void apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
    localStorage.clear();
    setTokens("", "");
    setSession(null);
  }, [session]);

  useEffect(() => {
    setOnSessionExpired(logout);
  }, [logout]);

  useEffect(() => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const username = localStorage.getItem(STORAGE_KEYS.username);
    const role = localStorage.getItem(STORAGE_KEYS.role);
    const userId = localStorage.getItem(STORAGE_KEYS.userId) ?? "";
    const onboardingCompletedAt = localStorage.getItem(STORAGE_KEYS.onboardingCompletedAt);
    const leaveWorkflowVisitedAt = localStorage.getItem(STORAGE_KEYS.leaveWorkflowVisitedAt);

    if (accessToken && refreshToken && username && role) {
      setTokens(accessToken, refreshToken);
      setSession({
        userId,
        accessToken,
        refreshToken,
        username,
        role,
        onboardingCompletedAt: onboardingCompletedAt || null,
        leaveWorkflowVisitedAt: leaveWorkflowVisitedAt || null,
      });
    }
    setLoading(false);
  }, []);

  const login = useCallback((s: Session) => {
    persistSession(s);
    setTokens(s.accessToken, s.refreshToken);
    setSession(s);
  }, []);

  const updateSession = useCallback((patch: Partial<Session>) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      persistSession(next);
      setTokens(next.accessToken, next.refreshToken);
      return next;
    });
  }, []);

  return { session, loading, login, logout, updateSession };
}
