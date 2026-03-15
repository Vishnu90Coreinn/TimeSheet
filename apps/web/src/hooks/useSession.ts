import { useCallback, useEffect, useState } from "react";
import { apiFetch, setOnSessionExpired, setTokens } from "../api/client";
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
      // Restore session immediately so the page doesn't flash to login
      setSession({ userId, accessToken, refreshToken, username, role });
      setLoading(false);

      // Verify with server in background to pick up role/username changes
      apiFetch("/auth/me").then(async (r) => {
        if (r.ok) {
          const me = await r.json();
          // Re-read tokens from localStorage in case apiFetch refreshed them
          const currentAccess = localStorage.getItem("accessToken") ?? accessToken;
          const currentRefresh = localStorage.getItem("refreshToken") ?? refreshToken;
          const verifiedSession: Session = {
            userId: me.id ?? userId,
            accessToken: currentAccess,
            refreshToken: currentRefresh,
            username: me.username ?? username,
            role: me.role ?? role,
          };
          localStorage.setItem("role", verifiedSession.role);
          localStorage.setItem("username", verifiedSession.username);
          setSession(verifiedSession);
        } else if (r.status === 401) {
          // Explicit auth failure (access token invalid and refresh also failed)
          localStorage.clear();
          setTokens("", "");
          setSession(null);
        }
        // Any other error (5xx, 404, network) — keep the restored session
      }).catch(() => {
        // Network error — keep the restored session
      });
    } else {
      setLoading(false);
    }
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
