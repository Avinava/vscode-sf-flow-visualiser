/**
 * Canvas Toolbar Component
 *
 * Provides zoom controls, auto-layout toggle, theme toggle, and fit-to-view
 * for the flow canvas.
 */

import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Home,
  Layout,
  Sun,
  Moon,
  Maximize,
  Keyboard,
  Play,
  Pause,
} from "lucide-react";
import { useTheme } from "../../context";

export interface CanvasToolbarProps {
  scale: number;
  autoLayoutEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToView: () => void;
  onToggleAutoLayout: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  scale,
  autoLayoutEnabled,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToView,
  onToggleAutoLayout,
}) => {
  const { isDark, toggleTheme, animateFlow, toggleAnimation } = useTheme();
  const [showShortcuts, setShowShortcuts] = React.useState(false);

  return (
    <>
      {/* Main toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 px-2 py-1 flex items-center gap-1">
        <button
          onClick={onZoomIn}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={16} className="text-slate-600 dark:text-slate-300" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} className="text-slate-600 dark:text-slate-300" />
        </button>
        <button
          onClick={onResetView}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Reset View (0)"
        >
          <Home size={16} className="text-slate-600 dark:text-slate-300" />
        </button>
        <button
          onClick={onFitToView}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Fit to View (F)"
        >
          <Maximize size={16} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-0.5"></div>
        <button
          onClick={onToggleAutoLayout}
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors
            ${autoLayoutEnabled ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
        >
          <Layout size={14} />
          Auto-Layout
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-0.5"></div>
        <button
          onClick={toggleAnimation}
          className={`p-1.5 rounded-md transition-colors ${
            animateFlow
              ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : "hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title={
            animateFlow ? "Stop Flow Animation (A)" : "Animate Data Flow (A)"
          }
        >
          {animateFlow ? (
            <Pause size={16} className="text-green-600 dark:text-green-400" />
          ) : (
            <Play size={16} className="text-slate-600 dark:text-slate-300" />
          )}
        </button>
        <button
          onClick={toggleTheme}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? (
            <Sun size={16} className="text-amber-500" />
          ) : (
            <Moon size={16} className="text-slate-600" />
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard
              size={16}
              className="text-slate-600 dark:text-slate-300"
            />
          </button>
          {/* Shortcuts dropdown */}
          {showShortcuts && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Keyboard Shortcuts
              </div>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Zoom In</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    +
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span>Zoom Out</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    -
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span>Reset View</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    0
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span>Fit to View</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    F
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span>Toggle Theme</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    T
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span>Animate Flow</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                    A
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md shadow border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
        {Math.round(scale * 100)}%
      </div>
    </>
  );
};

export default CanvasToolbar;
