/**
 * Canvas Toolbar Component
 *
 * Provides zoom controls and auto-layout toggle for the flow canvas.
 */

import React from "react";
import { ZoomIn, ZoomOut, Home, Layout } from "lucide-react";

export interface CanvasToolbarProps {
  scale: number;
  autoLayoutEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleAutoLayout: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  scale,
  autoLayoutEnabled,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleAutoLayout,
}) => {
  return (
    <>
      {/* Main toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white rounded-lg shadow border border-slate-200 px-2 py-1 flex items-center gap-1">
        <button
          onClick={onZoomIn}
          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} className="text-slate-600" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} className="text-slate-600" />
        </button>
        <button
          onClick={onResetView}
          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
          title="Reset"
        >
          <Home size={16} className="text-slate-600" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5"></div>
        <button
          onClick={onToggleAutoLayout}
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors
            ${autoLayoutEnabled ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100 text-slate-600"}`}
        >
          <Layout size={14} />
          Auto-Layout
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 z-10 bg-white px-2.5 py-1 rounded-md shadow border border-slate-200 text-xs font-medium text-slate-500">
        {Math.round(scale * 100)}%
      </div>
    </>
  );
};

export default CanvasToolbar;
