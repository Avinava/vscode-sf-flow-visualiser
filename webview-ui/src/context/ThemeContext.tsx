/**
 * Theme Context
 *
 * Manages theme state for the flow visualizer.
 * - Automatically detects VS Code theme (light/dark/high-contrast)
 * - Allows user to manually toggle theme
 * - Persists user preference via VS Code state
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { getVSCodeApi } from "../utils/vscodeApi";

// ============================================================================
// TYPES
// ============================================================================

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  // Canvas
  canvasBackground: string;
  canvasGridColor: string;

  // Node
  nodeBackground: string;
  nodeBorder: string;
  nodeBorderHover: string;
  nodeBorderSelected: string;
  nodeText: string;
  nodeTextMuted: string;
  nodeShadow: string;

  // Sidebar / Panel
  panelBackground: string;
  panelBorder: string;

  // Connector
  connectorDefault: string;
  connectorFault: string;
  connectorHighlight: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // UI Elements
  buttonHover: string;
  badge: string;
}

export interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  // Animation
  animateFlow: boolean;
  toggleAnimation: () => void;
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const LIGHT_COLORS: ThemeColors = {
  canvasBackground: "#f8fafc",
  canvasGridColor: "#e2e8f0",
  nodeBackground: "#ffffff",
  nodeBorder: "#e2e8f0",
  nodeBorderHover: "#94a3b8",
  nodeBorderSelected: "#3b82f6",
  nodeText: "#1e293b",
  nodeTextMuted: "#64748b",
  nodeShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  panelBackground: "#ffffff",
  panelBorder: "#e2e8f0",
  connectorDefault: "#94a3b8",
  connectorFault: "#ef4444",
  connectorHighlight: "#60a5fa",
  textPrimary: "#1e293b",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  buttonHover: "#f1f5f9",
  badge: "#f1f5f9",
};

const DARK_COLORS: ThemeColors = {
  canvasBackground: "#0f172a",
  canvasGridColor: "#1e293b",
  nodeBackground: "#1e293b",
  nodeBorder: "#334155",
  nodeBorderHover: "#475569",
  nodeBorderSelected: "#3b82f6",
  nodeText: "#f1f5f9",
  nodeTextMuted: "#94a3b8",
  nodeShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
  panelBackground: "#1e293b",
  panelBorder: "#334155",
  connectorDefault: "#64748b",
  connectorFault: "#f87171",
  connectorHighlight: "#60a5fa",
  textPrimary: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#64748b",
  buttonHover: "#334155",
  badge: "#334155",
};

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Get shared VS Code API instance
const vscode = getVSCodeApi();

// ============================================================================
// HOOK
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Detect if VS Code is using a dark theme
 */
function detectVSCodeTheme(): boolean {
  // VS Code injects theme info via body classes or CSS variables
  const body = document.body;

  // Check for VS Code theme class
  if (
    body.classList.contains("vscode-dark") ||
    body.classList.contains("vscode-high-contrast")
  ) {
    return true;
  }
  if (body.classList.contains("vscode-light")) {
    return false;
  }

  // Fallback: check CSS variable or computed background color
  const bgColor = getComputedStyle(body).backgroundColor;
  if (bgColor) {
    // Parse rgb values and check luminance
    const match = bgColor.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match.map(Number);
      // Calculate relative luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
  }

  // Fallback to system preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Check for persisted state on initial load
  const initialState = vscode?.getState() as
    | { themeMode?: ThemeMode; animateFlow?: boolean }
    | undefined;

  // Initialize mode from persisted state or default to "light"
  const [mode, setModeState] = useState<ThemeMode>(
    initialState?.themeMode ?? "light"
  );
  const [systemIsDark, setSystemIsDark] = useState(() => detectVSCodeTheme());

  // Animation state - persisted, defaults to true (on)
  const [animateFlow, setAnimateFlow] = useState<boolean>(
    initialState?.animateFlow ?? true
  );

  // Listen for state restoration from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { command, payload } = event.data;
      if (command === "restoreState" && payload) {
        // Only restore from extension host if values are explicitly set
        if (payload.themeMode) {
          setModeState(payload.themeMode);
        }
        if (payload.animateFlow !== undefined) {
          setAnimateFlow(payload.animateFlow);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Listen for VS Code theme changes (body class mutations)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setSystemIsDark(detectVSCodeTheme());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemIsDark(detectVSCodeTheme());
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Calculate actual dark mode state
  const isDark = useMemo(() => {
    if (mode === "system") return systemIsDark;
    return mode === "dark";
  }, [mode, systemIsDark]);

  // Apply dark class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const colors = useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);

  // Persist theme mode when it changes
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    // Persist to VS Code webview state
    if (vscode) {
      const currentState = vscode.getState() || {};
      vscode.setState({ ...currentState, themeMode: newMode });
      // Also persist to extension globalState
      vscode.postMessage({
        command: "saveState",
        payload: { key: "themeMode", value: newMode },
      });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const newMode =
        prev === "system"
          ? isDark
            ? "light"
            : "dark"
          : prev === "dark"
            ? "light"
            : "dark";

      // Persist to VS Code webview state
      if (vscode) {
        const currentState = vscode.getState() || {};
        vscode.setState({ ...currentState, themeMode: newMode });
        // Also persist to extension globalState
        vscode.postMessage({
          command: "saveState",
          payload: { key: "themeMode", value: newMode },
        });
      }

      return newMode;
    });
  }, [isDark]);

  // Toggle flow animation
  const toggleAnimation = useCallback(() => {
    setAnimateFlow((prev) => {
      const newValue = !prev;
      // Persist to VS Code webview state
      if (vscode) {
        const currentState = vscode.getState() || {};
        vscode.setState({ ...currentState, animateFlow: newValue });
        // Also persist to extension globalState
        vscode.postMessage({
          command: "saveState",
          payload: { key: "animateFlow", value: newValue },
        });
      }
      return newValue;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors,
      setMode,
      toggleTheme,
      animateFlow,
      toggleAnimation,
    }),
    [mode, isDark, colors, setMode, toggleTheme, animateFlow, toggleAnimation]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeProvider;
