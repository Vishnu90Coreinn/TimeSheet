/** Colour math utilities shared by ColorPicker and TenantSettingsContext. */

// ─── HSV ↔ Hex ───────────────────────────────────────────────────────────────

/** Converts a 6-digit hex colour (#rrggbb) to [h°(0-360), s(0-1), v(0-1)]. */
export function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

/** Converts [h°(0-360), s(0-1), v(0-1)] to a 6-digit hex colour. */
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {         g = c; b = x; }
  else if (h < 240) {         g = x; b = c; }
  else if (h < 300) { r = x;         b = c; }
  else              { r = c;         b = x; }
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, (n + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── HSL ↔ Hex ───────────────────────────────────────────────────────────────

/** Converts a hex colour to [h(0-1), s(0-1), l(0-1)]. */
export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

/** Converts [h(0-1), s(0-1), l(0-1)] to a 6-digit hex colour. */
export function hslToHex(h: number, s: number, l: number): string {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  l = clamp(l); s = clamp(s);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(clamp(color) * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Generates a 9-stop HSL colour scale (50–900) from a single hex-500 anchor. */
export function buildScale(hex: string): Record<number, string> {
  const [h, s, l] = hexToHsl(hex);
  const stops: [number, number][] = [
    [50,  0.97], [100, 0.93], [200, 0.86], [300, 0.76], [400, 0.63],
    [500, l],
    [600, l * 0.85], [700, l * 0.70], [800, l * 0.55], [900, l * 0.42],
  ];
  return Object.fromEntries(stops.map(([stop, lightness]) => [stop, hslToHex(h, s, lightness)]));
}

// ─── WCAG ─────────────────────────────────────────────────────────────────────

/** Returns the WCAG 2.1 contrast ratio between the given colour and white (#ffffff). */
export function wcagContrastRatio(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const Lwhite = 1;
  return (Lwhite + 0.05) / (L + 0.05);
}

/** Applies a full brand colour scale from a single hex-500 value to :root CSS variables. */
export function applyBrandColor(hex500: string) {
  const root = document.documentElement;
  const scale = buildScale(hex500);
  for (const [stop, value] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${stop}`, value);
    root.style.setProperty(`--color-brand-${stop}`, value);
  }
  root.style.setProperty("--color-primary",        scale[600]);
  root.style.setProperty("--color-primary-hover",  scale[700]);
  root.style.setProperty("--color-primary-light",  scale[300]);
  root.style.setProperty("--color-primary-subtle", scale[50]);
  root.style.setProperty("--color-border-focus",   scale[500]);
  root.style.setProperty("--text-brand",           scale[700]);
  root.style.setProperty("--border-brand",         scale[400]);
}
