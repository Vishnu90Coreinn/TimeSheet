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

export function ColorsTab({ primaryColor, onPrimaryColorChange }: ColorsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Colour picker */}
      <div className="form-group">
        <label className="form-label">Primary Colour</label>
        <ColorPicker value={primaryColor} onChange={onPrimaryColorChange} />
      </div>

      {/* Brand presets */}
      <div>
        <p className="form-label mb-2">Brand Presets</p>
        <p className="form-hint mb-3">Click a preset to apply instantly. You can refine further using the picker above.</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(preset => {
            const scale = buildScale(preset.hex);
            const isActive = primaryColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                className="text-left rounded-lg p-3 border transition-all cursor-pointer"
                style={isActive
                  ? { borderColor: preset.hex, background: `${preset.hex}0d` }
                  : { borderColor: "var(--border-default, #e2e8f0)", background: "white" }
                }
                onClick={() => onPrimaryColorChange(preset.hex)}
              >
                <div className="flex gap-1.5 mb-2">
                  {[scale[500], scale[400], scale[200]].map(c => (
                    <div key={c} className="w-4 h-4 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <p className="text-[0.8rem] font-semibold" style={{ color: isActive ? preset.hex : "var(--text-primary, #1e293b)" }}>{preset.name}</p>
                <p className="text-[0.72rem]" style={{ color: "var(--text-tertiary, #94a3b8)" }}>{preset.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
