/**
 * Shared avatar color utilities.
 * Provides a deterministic color derived from a name string.
 */

export const AVATAR_PALETTE = [
  "#818cf8", "#a78bfa", "#34d399", "#60a5fa",
  "#f472b6", "#fb923c", "#facc15", "#4ade80",
  "#38bdf8", "#f87171",
];

/** Deterministic color for a given name (consistent across renders). */
export function avatarColor(name: string): string {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}
