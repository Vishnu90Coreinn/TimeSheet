const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000/api/v1";

let _accessToken = "";
let _refreshToken = "";
let _onSessionExpired: (() => void) | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
}

export function getAccessToken(): string { return _accessToken; }

export function setOnSessionExpired(cb: () => void) {
  _onSessionExpired = cb;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && _refreshToken) {
    // Attempt token refresh once
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      if (data.role) localStorage.setItem("role", data.role);

      // Retry original request with new token
      headers["Authorization"] = `Bearer ${_accessToken}`;
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else {
      // Refresh failed — session expired
      _onSessionExpired?.();
    }
  }

  return response;
}

export { API_BASE };
