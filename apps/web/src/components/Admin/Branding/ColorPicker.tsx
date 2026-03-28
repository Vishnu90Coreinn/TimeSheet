/**
 * ColorPicker.tsx — Saturation/brightness square + hue strip + hex input + WCAG badge.
 * No external library — all colour math is in colorUtils.ts.
 */
import { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, wcagContrastRatio } from "../../../utils/colorUtils";

interface ColorPickerProps {
  value: string;   // 6-digit hex, e.g. "#6366f1"
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const hsvRef = useRef(hsv);

  useEffect(() => {
    const current = hsvToHex(...hsvRef.current);
    if (value !== current) {
      const next = hexToHsv(value);
      hsvRef.current = next;
      setHsv(next);
      setHexInput(value);
    }
  }, [value]);

  useEffect(() => { hsvRef.current = hsv; }, [hsv]);

  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  function updateFromSquare(e: React.PointerEvent) {
    const rect = squareRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const next: [number, number, number] = [hsvRef.current[0], s, v];
    hsvRef.current = next;
    setHsv(next);
    const hex = hsvToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }

  function updateFromHue(e: React.PointerEvent) {
    const rect = hueRef.current!.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    const next: [number, number, number] = [h, hsvRef.current[1], hsvRef.current[2]];
    hsvRef.current = next;
    setHsv(next);
    const hex = hsvToHex(...next);
    setHexInput(hex);
    onChange(hex);
  }

  const hueColour = hsvToHex(hsv[0], 1, 1);
  const contrast = wcagContrastRatio(value);
  const wcagLabel = contrast >= 7 ? "AAA ✓" : contrast >= 4.5 ? "AA ✓" : contrast >= 3 ? "AA ✗" : "Fail";
  const wcagBg = contrast >= 4.5
    ? "bg-green-100 text-green-800 border border-green-200"
    : contrast >= 3
    ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
    : "bg-red-100 text-red-800 border border-red-200";
  const wcagExplain = contrast >= 4.5
    ? `Contrast ${contrast.toFixed(1)}:1 — passes WCAG AA for white text`
    : contrast >= 3
    ? `Contrast ${contrast.toFixed(1)}:1 — fails WCAG AA (needs 4.5:1). Consider a darker shade.`
    : `Contrast ${contrast.toFixed(1)}:1 — fails WCAG AA. White text will be hard to read on this colour.`;
  const wcagExplainBg = contrast >= 4.5 ? "bg-green-50 text-green-700" : contrast >= 3 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700";

  return (
    <div className="flex flex-col gap-3 select-none w-full max-w-xs">
      {/* Saturation / brightness square */}
      <div
        ref={squareRef}
        className="relative h-32 w-full rounded-lg cursor-crosshair overflow-hidden"
        style={{ background: `linear-gradient(to right, #ffffff, ${hueColour})` }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); updateFromSquare(e); }}
        onPointerMove={e => { if (e.buttons > 0) updateFromSquare(e); }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000000)" }} />
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Hue strip */}
      <div
        ref={hueRef}
        className="relative h-3 w-full rounded-full cursor-pointer overflow-visible"
        style={{ background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))" }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); updateFromHue(e); }}
        onPointerMove={e => { if (e.buttons > 0) updateFromHue(e); }}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: `${(hsv[0] / 360) * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: hueColour,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          }}
        />
      </div>

      {/* Hex input + swatch + WCAG badge */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-md border border-[var(--border-default)] flex-shrink-0"
          style={{ background: value }}
        />
        <input
          type="text"
          className="form-input flex-1 font-mono text-sm"
          placeholder="#6366f1"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
              const next = hexToHsv(hexInput);
              hsvRef.current = next;
              setHsv(next);
              onChange(hexInput);
            } else {
              setHexInput(value);
            }
          }}
        />
        <span className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${wcagBg}`}>
          {wcagLabel}
        </span>
      </div>

      {/* WCAG explanation */}
      <p className={`text-[0.72rem] rounded-md px-3 py-2 ${wcagExplainBg}`}>
        {wcagExplain}
      </p>
    </div>
  );
}
