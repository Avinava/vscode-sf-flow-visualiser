/**
 * Canvas Context
 *
 * Provides centralized state management for canvas interactions
 * including pan, zoom, and view reset functionality.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  useCanvasInteraction,
  type Point,
} from "../hooks/useCanvasInteraction";

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface CanvasContextState {
  // Canvas state
  scale: number;
  pan: Point;

  // Event handlers
  onMouseDown: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;

  // Actions
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setScale: (scale: number) => void;
  setPan: (pan: Point) => void;

  // State flags
  isDragging: boolean;

  // Computed styles
  getCanvasTransform: () => string;
  getBackgroundPosition: () => string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CanvasContext = createContext<CanvasContextState | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface CanvasProviderProps {
  children: ReactNode;
  initialScale?: number;
  initialPan?: Point;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({
  children,
  initialScale = 0.9,
  initialPan = { x: 0, y: 0 },
}) => {
  const canvasInteraction = useCanvasInteraction({
    initialScale,
    initialPan,
  });

  // Compute canvas transform string
  const getCanvasTransform = useCallback(() => {
    const { scale, pan } = canvasInteraction.state;
    return `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
  }, [canvasInteraction.state]);

  // Compute background position for grid
  const getBackgroundPosition = useCallback(() => {
    const { pan } = canvasInteraction.state;
    return `${pan.x}px ${pan.y}px`;
  }, [canvasInteraction.state]);

  // Memoize context value
  const contextValue = useMemo<CanvasContextState>(
    () => ({
      // Canvas state
      scale: canvasInteraction.state.scale,
      pan: canvasInteraction.state.pan,

      // Event handlers
      onMouseDown: canvasInteraction.onMouseDown,
      onWheel: canvasInteraction.onWheel,

      // Actions
      zoomIn: canvasInteraction.zoomIn,
      zoomOut: canvasInteraction.zoomOut,
      resetView: canvasInteraction.resetView,
      setScale: canvasInteraction.setScale,
      setPan: canvasInteraction.setPan,

      // State flags
      isDragging: canvasInteraction.isDragging,

      // Computed styles
      getCanvasTransform,
      getBackgroundPosition,
    }),
    [canvasInteraction, getCanvasTransform, getBackgroundPosition]
  );

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access canvas context
 *
 * @throws Error if used outside of CanvasProvider
 */
export function useCanvas(): CanvasContextState {
  const context = useContext(CanvasContext);

  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }

  return context;
}

export default CanvasContext;
