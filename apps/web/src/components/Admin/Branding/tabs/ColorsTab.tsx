import { ColorPicker } from "../ColorPicker";
import { buildScale } from "../../../../utils/colorUtils";

const PRESETS = [
  { name: "Indigo",      hex: "#6366f1", tagline: "Default"      },
  { name: "Ocean Blue",  hex: "#0ea5e9", tagline: "Professional" },
  { name: "Emerald",     hex: "#10b981", tagline: "Fresh"        },
  { name: "Amber",       hex: "#f59e0b", tagline: "Warm"         },
  { name: "Rose",        hex: "#f43f5e", tagline: "Bold"         },
  { name: "Slate",       hex: "#64748b", tagline: "Neutral"      },
] as const;

interface ColorsTabProps {
  primaryColor: string;
  onPrimaryColorChange: (hex: string) => void;
}

/** Mini sidebar thumbnail shown inside each preset card */
function MiniSidebar({ color }: { color: string }) {
  return (
    <div
      className="flex-shrink-0 rounded overflow-hidden"
      style={{ width: 22, height: 52, background: "#1e1b4b", padding: "4px 3px" }}
      aria-hidden="true"
    >
      {/* Logo dot */}
      <div className="rounded-full mb-1.5 mx-auto" style={{ width: 8, height: 8, background: color }} />
      {/* Nav items */}
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="rounded mb-0.5"
          style={{
            height: 4,
            background: i === 1 ? `${color}99` : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}

export function ColorsTab({ primaryColor, onPrimaryColorChange }: ColorsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Brand Presets — shown first so they're immediately visible */}
      <div>
        <p className="form-label mb-1">Brand Presets</p>
        <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
          Click a preset to apply instantly. Expand "Custom Colour" below to fine-tune.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(preset => {
            const scale = buildScale(preset.hex);
            const isActive = primaryColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                aria-pressed={isActive}
                className="relative text-left rounded-lg p-3 border transition-all cursor-pointer hover:shadow-md"
                style={isActive
                  ? { borderColor: preset.hex, background: `${preset.hex}0d` }
                  : { borderColor: "var(--border-default, #e2e8f0)", background: "white" }
                }
                onClick={() => onPrimaryColorChange(preset.hex)}
              >
                {/* Selected checkmark badge */}
                {isActive && (
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold"
                    style={{ background: preset.hex }}
                    aria-label="Selected"
                  >
                    ✓
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2">
                  {/* Mini sidebar thumbnail */}
                  <MiniSidebar color={preset.hex} />

                  {/* Colour swatches */}
                  <div className="flex flex-col gap-1">
                    {[scale[500], scale[400], scale[200]].map(c => (
                      <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                </div>

                <p className="text-[0.78rem] font-semibold leading-tight" style={{ color: isActive ? preset.hex : "var(--text-primary, #1e293b)" }}>
                  {preset.name}
                </p>
                <p className="text-[0.7rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>
                  {preset.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom colour picker — collapsible, shown below presets */}
      <div className="flex flex-col gap-1.5">
        <label className="form-label">Custom Colour</label>
        <ColorPicker value={primaryColor} onChange={onPrimaryColorChange} />
      </div>
    </div>
  );
}
