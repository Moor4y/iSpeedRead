import type { TtsLang } from "../types";
import "./TtsControls.css";

export interface TtsControlsProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  lang: TtsLang;
  onLangChange: (lang: TtsLang) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  error: string | null;
}

const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export function TtsControls({
  enabled,
  onToggleEnabled,
  isPlaying,
  isLoading,
  onTogglePlay,
  lang,
  onLangChange,
  playbackRate,
  onPlaybackRateChange,
  error,
}: TtsControlsProps) {
  return (
    <div className="tts-controls">
      <div className="tts-controls__toolbar">
        <button
          type="button"
          className={`tts-controls__btn${enabled ? " tts-controls__btn--on" : ""}`}
          onClick={onToggleEnabled}
          aria-pressed={enabled}
        >
          TTS
        </button>
        <button
          type="button"
          className="tts-controls__btn tts-controls__btn--play"
          disabled={!enabled || isLoading}
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? "…" : isPlaying ? "❚❚" : "▶"}
        </button>
        <div className="tts-controls__lang">
          <button
            type="button"
            className={`tts-controls__lang-btn${lang === "en" ? " tts-controls__lang-btn--active" : ""}`}
            onClick={() => onLangChange("en")}
            disabled={!enabled}
          >
            EN
          </button>
          <button
            type="button"
            className={`tts-controls__lang-btn${lang === "zh" ? " tts-controls__lang-btn--active" : ""}`}
            onClick={() => onLangChange("zh")}
            disabled={!enabled}
          >
            中文
          </button>
        </div>
        {enabled && (
          <div className="tts-controls__speed tts-controls__speed--inline">
            <span className="tts-controls__speed-label">Speed</span>
            <input
              type="range"
              min={0}
              max={SPEED_STEPS.length - 1}
              step={1}
              value={Math.max(
                0,
                SPEED_STEPS.findIndex((s) => s === playbackRate)
              )}
              onChange={(e) => {
                const idx = Number(e.target.value);
                onPlaybackRateChange(SPEED_STEPS[idx] ?? 1);
              }}
              className="tts-controls__slider"
            />
            <span className="tts-controls__speed-value">
              {playbackRate.toFixed(2)}×
            </span>
          </div>
        )}
      </div>
      {enabled && (
        <div className="tts-controls__speed tts-controls__speed--portrait">
          <span className="tts-controls__speed-label">Speed</span>
          <input
            type="range"
            min={0}
            max={SPEED_STEPS.length - 1}
            step={1}
            value={Math.max(
              0,
              SPEED_STEPS.findIndex((s) => s === playbackRate)
            )}
            onChange={(e) => {
              const idx = Number(e.target.value);
              onPlaybackRateChange(SPEED_STEPS[idx] ?? 1);
            }}
            className="tts-controls__slider"
          />
          <span className="tts-controls__speed-value">
            {playbackRate.toFixed(2)}×
          </span>
        </div>
      )}
      {error && <p className="tts-controls__error">{error}</p>}
    </div>
  );
}
