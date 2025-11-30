/**
 * Flow Canvas Component
 *
 * Main canvas area for rendering the flow visualization.
 * Handles pan/zoom and displays nodes and edges.
 */

import React, { useRef, type ReactNode } from "react";
import { useTheme } from "../../context";

export interface FlowCanvasProps {
  /** Pan offset */
  pan: { x: number; y: number };
  /** Zoom scale */
  scale: number;
  /** Mouse down handler for panning */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Wheel handler for zooming */
  onWheel: (e: React.WheelEvent) => void;
  /** Child elements (nodes, edges) */
  children: ReactNode;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  pan,
  scale,
  onMouseDown,
  onWheel,
  children,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  return (
    <div
      ref={canvasRef}
      className="w-full h-full cursor-grab select-none"
      onMouseDown={onMouseDown}
      onWheel={onWheel}
      style={{
        backgroundImage: `radial-gradient(circle, ${isDark ? "#374151" : "#d1d5db"} 1px, transparent 1px)`,
        backgroundSize: "16px 16px",
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        position: "relative",
        overflow: "hidden",
        backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      }}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          width: "4000px",
          height: "4000px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default FlowCanvas;
