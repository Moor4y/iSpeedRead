import { useState } from "react";
import type { TtsLang, TtsVoice } from "../types";
import { TTS_VOICE_OPTIONS, TTS_SPEED_STEPS, effectiveSpeed } from "../types";
import "./TtsControls.css";

export interface TtsControlsProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  lang: TtsLang;
  onLangChange: (lang: TtsLang) => void;
  voice: TtsVoice;
  onVoiceChange: (voice: TtsVoice) => void;
  clientRate: number;
  onClientRateChange: (rate: number) => void;
  error: string | null;
}

/** Derive the contextual label for the main action button. */
function listenLabel(
  enabled: boolean,
  isLoading: boolean,
  isPlaying: boolean
): string {
  if (!enabled) return "Listen";
  if (isLoading) return "…";
  if (isPlaying) return "Pause";
  return "Listen";
}

export function TtsControls({
  enabled,
  onToggleEnabled,
  isPlaying,
  isLoading,
  onTogglePlay,
  onStop,
  lang,
  onLangChange,
  voice,
  onVoiceChange,
  clientRate,
  onClientRateChange,
  error,
}: TtsControlsProps) {
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);

  const voicesForLang = TTS_VOICE_OPTIONS.filter((o) => o.lang === lang);
  const speedIndex = Math.max(0, TTS_SPEED_STEPS.findIndex((s) => s === clientRate));

  const handleLangChange = (nextLang: TtsLang) => {
    onLangChange(nextLang);
    // Close voice panel when switching language so user sees the filtered list fresh
    setVoicePanelOpen(false);
  };

  const SpeedRow = () => (
    <div className="tts-controls__speed">
      <span className="tts-controls__speed-label">Speed</span>
      <input
        type="range"
        min={0}
        max={TTS_SPEED_STEPS.length - 1}
        step={1}
        value={speedIndex}
        onChange={(e) => {
          const idx = Number(e.target.value);
          onClientRateChange(TTS_SPEED_STEPS[idx] ?? 1);
        }}
        className="tts-controls__slider"
        aria-label="Playback speed"
      />
      <span className="tts-controls__speed-value">
        {effectiveSpeed(clientRate)}
      </span>
    </div>
  );

  return (
    <div className="tts-controls">
      {/* ── Main toolbar ── */}
      <div className="tts-controls__toolbar">

        {/* Listen / Pause contextual button */}
        <button
          type="button"
          className={`tts-controls__listen${enabled && isPlaying ? " tts-controls__listen--pause" : ""}${enabled && !isPlaying && !isLoading ? " tts-controls__listen--ready" : ""}`}
          onClick={() => {
            if (!enabled) {
              onToggleEnabled();
              // Start playing immediately when enabling
              setTimeout(onTogglePlay, 0);
            } else {
              onTogglePlay();
            }
          }}
          disabled={isLoading}
          aria-label={listenLabel(enabled, isLoading, isPlaying)}
        >
          {listenLabel(enabled, isLoading, isPlaying)}
        </button>

        {/* Stop button — only visible while TTS is active */}
        {enabled && (
          <button
            type="button"
            className="tts-controls__stop"
            onClick={() => {
              onStop();
              onToggleEnabled();
            }}
            aria-label="Stop and disable TTS"
          >
            Stop
          </button>
        )}

        {/* Language selector */}
        <div className="tts-controls__lang" role="group" aria-label="Language">
          <button
            type="button"
            className={`tts-controls__lang-btn${lang === "en" ? " tts-controls__lang-btn--active" : ""}`}
            onClick={() => handleLangChange("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`tts-controls__lang-btn${lang === "zh" ? " tts-controls__lang-btn--active" : ""}`}
            onClick={() => handleLangChange("zh")}
          >
            中文
          </button>
        </div>

        {/* Voice picker toggle */}
        <button
          type="button"
          className={`tts-controls__voice-toggle${voicePanelOpen ? " tts-controls__voice-toggle--open" : ""}`}
          onClick={() => setVoicePanelOpen((v) => !v)}
          aria-expanded={voicePanelOpen}
          aria-label="Select voice"
        >
          {TTS_VOICE_OPTIONS.find((o) => o.voice === voice)?.label ?? voice}
          <span className="tts-controls__voice-caret" aria-hidden>▾</span>
        </button>

        {/* Inline speed row (landscape) */}
        {enabled && (
          <div className="tts-controls__speed tts-controls__speed--inline">
            <SpeedRow />
          </div>
        )}
      </div>

      {/* ── Voice picker panel ── */}
      {voicePanelOpen && (
        <div className="tts-controls__voice-panel" role="listbox" aria-label="Voice options">
          {voicesForLang.map((opt) => (
            <button
              key={opt.voice}
              type="button"
              role="option"
              aria-selected={voice === opt.voice}
              className={`tts-controls__voice-option${voice === opt.voice ? " tts-controls__voice-option--active" : ""}`}
              onClick={() => {
                onVoiceChange(opt.voice);
                setVoicePanelOpen(false);
              }}
            >
              {opt.label}
              <span className="tts-controls__voice-name">{opt.voice}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Portrait speed row ── */}
      {enabled && (
        <div className="tts-controls__speed tts-controls__speed--portrait">
          <SpeedRow />
        </div>
      )}

      {error && <p className="tts-controls__error" role="alert">{error}</p>}
    </div>
  );
}
