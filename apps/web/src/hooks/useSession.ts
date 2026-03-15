import { useCallback, useEffect, useState } from "react";
import { setOnSessionExpired, setTokens } from "../api/client";
import { apiFetch } from "../api/client";
import type { Session } from "../types";

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
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("userId") ?? "";

    if (accessToken && refreshToken && username && role) {
      setTokens(accessToken, refreshToken);
      setSession({ userId, accessToken, refreshToken, username, role });
    }
    setLoading(false);
  }, []);

  const login = useCallback((s: Session) => {
    localStorage.setItem("accessToken", s.accessToken);
    localStorage.setItem("refreshToken", s.refreshToken);
    localStorage.setItem("username", s.username);
    localStorage.setItem("role", s.role);
    localStorage.setItem("userId", s.userId);
    setTokens(s.accessToken, s.refreshToken);
    setSession(s);
  }, []);

  return { session, loading, login, logout };
}
