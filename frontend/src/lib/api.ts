/**
 * Base URL for all backend API calls.
 *
 * Development: leave VITE_API_BASE_URL empty — Vite's dev proxy forwards
 *              relative /api/* requests to localhost:8000.
 * Production:  set VITE_API_BASE_URL to the backend origin, e.g.
 *              VITE_API_BASE_URL=https://api.bounce.example.com
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** Build a full API URL from a path (e.g. "/api/auth/token/"). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** Authenticated fetch — attaches Bearer token and sets Content-Type. */
export function authFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const { headers, ...rest } = options;
  return fetch(apiUrl(path), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(headers ?? {}),
    },
  });
}
