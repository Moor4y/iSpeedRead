import { useEffect, useState } from "react";
import { CatalogView } from "./components/CatalogView";
import { ReadingView } from "./components/ReadingView";
import { SettingsPanel } from "./components/SettingsPanel";
import type { AppView, BookMetadata } from "./types";
import type { Theme } from "./settings";
import { loadSettings, saveSettings, applySettings, FONT_DEFAULT } from "./settings";

export default function App() {
  const [view, setView] = useState<AppView>("catalog");
  const [activeBook, setActiveBook] = useState<BookMetadata | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("oled");
  const [fontSize, setFontSize] = useState(FONT_DEFAULT);

  // Load and apply persisted settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setTheme(s.theme);
      setFontSize(s.fontSize);
      applySettings(s);
    }).catch(() => {
      applySettings({ theme: "oled", fontSize: FONT_DEFAULT });
    });
  }, []);

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    const next = { theme: t, fontSize };
    applySettings(next);
    void saveSettings(next);
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    const next = { theme, fontSize: size };
    applySettings(next);
    void saveSettings(next);
  };

  const openBook = (book: BookMetadata) => {
    setActiveBook(book);
    setView("reading");
  };

  const closeBook = () => {
    setView("catalog");
    setActiveBook(null);
  };

  return (
    <>
      {view === "reading" && activeBook ? (
        <ReadingView
          book={activeBook}
          onBack={closeBook}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <CatalogView
          onSelectBook={openBook}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          onThemeChange={handleThemeChange}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
