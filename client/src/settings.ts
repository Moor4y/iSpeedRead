import localforage from "localforage";

export type Theme = "oled" | "ivory" | "scroll";

export interface AppSettings {
  theme: Theme;
  /** Font size in px, drives --reading-font-size */
  fontSize: number;
}

const SETTINGS_KEY = "app-settings";
const FONT_MIN = 16;
const FONT_MAX = 36;
const FONT_DEFAULT = 24;

const store = localforage.createInstance({
  name: "ispeedread",
  storeName: "settings",
});

export async function loadSettings(): Promise<AppSettings> {
  const stored = await store.getItem<AppSettings>(SETTINGS_KEY);
  return stored ?? { theme: "oled", fontSize: FONT_DEFAULT };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await store.setItem(SETTINGS_KEY, s);
}

/** Apply theme and font-size to the document root immediately. */
export function applySettings(s: AppSettings): void {
  document.documentElement.setAttribute("data-theme", s.theme);
  document.documentElement.style.setProperty(
    "--reading-font-size",
    `${Math.min(FONT_MAX, Math.max(FONT_MIN, s.fontSize))}px`
  );
}

export { FONT_MIN, FONT_MAX, FONT_DEFAULT };
