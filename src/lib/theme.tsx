import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Theme handling.
 *
 * Three states, not two. "system" is a real, persistent choice that keeps
 * following the OS as it changes across the day - collapsing it to whatever
 * light/dark happened to be active at first paint would silently break the
 * user's preference at sunset.
 *
 * The actual palette lives in CSS variables (src/index.css); this only decides
 * whether `.dark` sits on <html>.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'mbaround:theme';

interface ThemeContextValue {
  /** What the user chose, including "system". */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  theme: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );
}

export function readStoredPreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** Applies the theme to <html>. Exported so the pre-paint script and React
 *  cannot drift apart in how they express "dark". */
export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Keeps native form controls, scrollbars and the URL bar in step; CSS
  // variables alone would leave those stubbornly light.
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    readStoredPreference,
  );
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Track the OS setting for as long as the preference is "system".
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // A theme choice made in one tab should not leave other tabs disagreeing.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPreferenceState(readStoredPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Private browsing can reject writes. The theme still applies for this
      // session; only persistence is lost, which is not worth crashing over.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
