import type { Theme } from "../settings";
import { FONT_MIN, FONT_MAX } from "../settings";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onClose: () => void;
}

const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: "oled",   label: "Night",     swatch: "#000000" },
  { id: "ivory",  label: "Day",       swatch: "#fffff0" },
  { id: "scroll", label: "Scroll",    swatch: "#f2ead3" },
];

export function SettingsPanel({
  theme,
  onThemeChange,
  fontSize,
  onFontSizeChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="settings-panel" role="dialog" aria-label="Display settings">
      <div className="settings-panel__backdrop" onClick={onClose} aria-hidden />

      <div className="settings-panel__sheet">
        <div className="settings-panel__header">
          <span className="settings-panel__title">Display</span>
          <button
            type="button"
            className="settings-panel__close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* ── Theme picker ── */}
        <section className="settings-panel__section">
          <p className="settings-panel__label">Theme</p>
          <div className="settings-panel__themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`settings-panel__theme-btn${theme === t.id ? " settings-panel__theme-btn--active" : ""}`}
                onClick={() => onThemeChange(t.id)}
                aria-pressed={theme === t.id}
              >
                <span
                  className="settings-panel__swatch"
                  style={{ background: t.swatch }}
                  aria-hidden
                />
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Font size slider ── */}
        <section className="settings-panel__section">
          <p className="settings-panel__label">
            Text size
            <span className="settings-panel__font-value">{fontSize}px</span>
          </p>
          <input
            type="range"
            min={FONT_MIN}
            max={FONT_MAX}
            step={1}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="settings-panel__slider"
            aria-label="Text size"
          />
          <div className="settings-panel__font-scale">
            <span style={{ fontSize: "14px" }}>A</span>
            <span style={{ fontSize: "22px" }}>A</span>
          </div>
        </section>
      </div>
    </div>
  );
}
