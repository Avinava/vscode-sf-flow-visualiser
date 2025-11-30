/**
 * Minimap Component
 *
 * A small overview map showing the entire flow with a viewport indicator.
 * Allows clicking to navigate to different parts of the flow.
 */

import React, { useMemo, useCallback, useRef } from "react";
import type { FlowNode } from "../../types";
import { NODE_CONFIG } from "../../constants";
import { useTheme } from "../../context";

export interface MinimapProps {
  /** All nodes in the flow */
  nodes: FlowNode[];
  /** Current pan position */
  pan: { x: number; y: number };
  /** Current zoom scale */
  scale: number;
  /** Callback to update pan position */
  onPanChange: (pan: { x: number; y: number }) => void;
  /** Viewport width */
  viewportWidth?: number;
  /** Viewport height */
  viewportHeight?: number;
}

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 10;

export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  pan,
  scale,
  onPanChange,
  viewportWidth = window.innerWidth - 320,
  viewportHeight = window.innerHeight - 60,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Calculate bounds of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 500,
        maxY: 500,
        width: 500,
        height: 500,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes]);

  // Calculate scale to fit content in minimap
  const minimapScale = useMemo(() => {
    const scaleX = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / bounds.width;
    const scaleY = (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / bounds.height;
    return Math.min(scaleX, scaleY, 0.15); // Cap at 15%
  }, [bounds]);

  // Transform node coordinates to minimap coordinates
  const transformToMinimap = useCallback(
    (x: number, y: number) => ({
      x: (x - bounds.minX) * minimapScale + MINIMAP_PADDING,
      y: (y - bounds.minY) * minimapScale + MINIMAP_PADDING,
    }),
    [bounds.minX, bounds.minY, minimapScale]
  );

  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = useMemo(() => {
    // The viewport shows content starting from -pan (because we translate by pan)
    const viewX = -pan.x / scale;
    const viewY = -pan.y / scale;
    const viewW = viewportWidth / scale;
    const viewH = viewportHeight / scale;

    const topLeft = transformToMinimap(viewX, viewY);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: viewW * minimapScale,
      height: viewH * minimapScale,
    };
  }, [
    pan,
    scale,
    viewportWidth,
    viewportHeight,
    minimapScale,
    transformToMinimap,
  ]);

  // Handle click on minimap to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap coordinates back to flow coordinates
      const flowX = (clickX - MINIMAP_PADDING) / minimapScale + bounds.minX;
      const flowY = (clickY - MINIMAP_PADDING) / minimapScale + bounds.minY;

      // Calculate new pan to center the clicked point
      const newPanX = -(flowX * scale - viewportWidth / 2);
      const newPanY = -(flowY * scale - viewportHeight / 2);

      onPanChange({ x: newPanX, y: newPanY });
    },
    [
      minimapScale,
      bounds.minX,
      bounds.minY,
      scale,
      viewportWidth,
      viewportHeight,
      onPanChange,
    ]
  );

  if (nodes.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-4 right-4 z-10 rounded-lg shadow-lg border overflow-hidden cursor-crosshair
        ${isDark ? "bg-slate-800/90 border-slate-700" : "bg-white/90 border-slate-200"}`}
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleClick}
    >
      {/* Flow nodes as small rectangles */}
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="absolute inset-0"
      >
        {/* Background grid hint */}
        <defs>
          <pattern
            id="minimap-grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="5"
              cy="5"
              r="0.5"
              fill={isDark ? "#334155" : "#e2e8f0"}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#minimap-grid)" />

        {/* Node rectangles */}
        {nodes.map((node) => {
          const config = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;
          const pos = transformToMinimap(node.x, node.y);
          const nodeW = Math.max(node.width * minimapScale, 3);
          const nodeH = Math.max(node.height * minimapScale, 2);

          // END nodes as circles
          if (node.type === "END") {
            return (
              <circle
                key={node.id}
                cx={pos.x + nodeW / 2}
                cy={pos.y + nodeH / 2}
                r={2}
                fill="#ef4444"
              />
            );
          }

          // DECISION/WAIT as diamonds
          if (node.type === "DECISION" || node.type === "WAIT") {
            const cx = pos.x + nodeW / 2;
            const cy = pos.y + nodeH / 2;
            const size = 3;
            return (
              <polygon
                key={node.id}
                points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
                fill={config.color}
              />
            );
          }

          return (
            <rect
              key={node.id}
              x={pos.x}
              y={pos.y}
              width={nodeW}
              height={nodeH}
              rx={1}
              fill={config.color}
              opacity={0.8}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill={isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)"}
          stroke={isDark ? "#60a5fa" : "#3b82f6"}
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
};

export default Minimap;
