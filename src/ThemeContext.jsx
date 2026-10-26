import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // 1. Stored preference
    const stored = localStorage.getItem("casemate_theme");
    if (stored === "dark" || stored === "light") return stored;
    // 2. OS preference
    try {
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch (_) {}
    return "light";
  });

  // Apply theme to <html> element immediately to prevent flash
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("casemate_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
