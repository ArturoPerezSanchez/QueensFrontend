import { useCallback, useEffect, useState } from "react";

const QUEENS_PATTERNS_KEY = "queens-show-patterns";
const CONFIG_CHANGED_EVENT = "logic-games-config-change";

function readStoredBoolean(key: string, fallback = false): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
    window.dispatchEvent(new Event(CONFIG_CHANGED_EVENT));
  } catch {
    // Ignore storage failures; the in-memory state still updates for this session.
  }
}

export function getStoredQueensPatterns(): boolean {
  return readStoredBoolean(QUEENS_PATTERNS_KEY);
}

export function useQueensPatternsSetting() {
  const [enabled, setEnabledState] = useState(() => getStoredQueensPatterns());

  useEffect(() => {
    const refresh = () => setEnabledState(getStoredQueensPatterns());

    window.addEventListener("storage", refresh);
    window.addEventListener(CONFIG_CHANGED_EVENT, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CONFIG_CHANGED_EVENT, refresh);
    };
  }, []);

  const setEnabled = useCallback((nextValue: boolean | ((current: boolean) => boolean)) => {
    setEnabledState((current) => {
      const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
      writeStoredBoolean(QUEENS_PATTERNS_KEY, resolved);
      return resolved;
    });
  }, []);

  return [enabled, setEnabled] as const;
}
