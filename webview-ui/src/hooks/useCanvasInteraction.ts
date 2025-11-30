/**
 * Canvas Interaction Hook
 *
 * Handles pan, zoom, and drag interactions for the flow canvas.
 * Provides smooth canvas navigation with mouse and wheel controls.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export interface Point {
  x: number;
  y: number;
}

export interface CanvasState {
  scale: number;
  pan: Point;
}

export interface UseCanvasInteractionOptions {
  /** Initial scale (default: 0.9) */
  initialScale?: number;
  /** Initial pan position (default: { x: 0, y: 0 }) */
  initialPan?: Point;
  /** Minimum zoom scale (default: 0.2) */
  minScale?: number;
  /** Maximum zoom scale (default: 2) */
  maxScale?: number;
  /** Zoom step increment (default: 0.1) */
  zoomStep?: number;
}

export interface UseCanvasInteractionResult {
  /** Current canvas state */
  state: CanvasState;
  /** Mouse down handler for canvas */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Wheel handler for zoom */
  onWheel: (e: React.WheelEvent) => void;
  /** Zoom in function */
  zoomIn: () => void;
  /** Zoom out function */
  zoomOut: () => void;
  /** Reset to initial view */
  resetView: () => void;
  /** Set scale directly */
  setScale: (scale: number) => void;
  /** Set pan directly */
  setPan: (pan: Point) => void;
  /** Whether currently dragging */
  isDragging: boolean;
}

const DEFAULT_OPTIONS: Required<UseCanvasInteractionOptions> = {
  initialScale: 0.9,
  initialPan: { x: 0, y: 0 },
  minScale: 0.2,
  maxScale: 2,
  zoomStep: 0.1,
};

/**
 * Hook for managing canvas pan and zoom interactions
 *
 * @param options - Configuration options
 * @returns Canvas interaction state and handlers
 */
export function useCanvasInteraction(
  options: UseCanvasInteractionOptions = {}
): UseCanvasInteractionResult {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [scale, setScaleState] = useState(config.initialScale);
  const [pan, setPanState] = useState<Point>(config.initialPan);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Use refs for drag state to avoid stale closures in event handlers
  const isDragging = useRef(false);
  const lastPos = useRef<Point>({ x: 0, y: 0 });

  // Clamp scale to min/max bounds
  const clampScale = useCallback(
    (newScale: number) => {
      return Math.min(Math.max(config.minScale, newScale), config.maxScale);
    },
    [config.minScale, config.maxScale]
  );

  // Mouse down handler - start dragging
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on a node
    if ((e.target as HTMLElement).closest(".flow-node")) return;

    e.preventDefault();
    isDragging.current = true;
    setIsDraggingState(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = "grabbing";
  }, []);

  // Document-level mouse move and up handlers for reliable dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;

      setPanState((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));

      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setIsDraggingState(false);
        document.body.style.cursor = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Wheel handler for zoom
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -config.zoomStep : config.zoomStep;
      setScaleState((prev) => clampScale(prev + delta));
    },
    [config.zoomStep, clampScale]
  );

  // Zoom in
  const zoomIn = useCallback(() => {
    setScaleState((prev) => clampScale(prev + config.zoomStep * 1.5));
  }, [config.zoomStep, clampScale]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setScaleState((prev) => clampScale(prev - config.zoomStep * 1.5));
  }, [config.zoomStep, clampScale]);

  // Reset to initial view
  const resetView = useCallback(() => {
    setPanState(config.initialPan);
    setScaleState(config.initialScale);
  }, [config.initialPan, config.initialScale]);

  // Set scale with bounds checking
  const setScale = useCallback(
    (newScale: number) => {
      setScaleState(clampScale(newScale));
    },
    [clampScale]
  );

  // Set pan
  const setPan = useCallback((newPan: Point) => {
    setPanState(newPan);
  }, []);

  return {
    state: { scale, pan },
    onMouseDown,
    onWheel,
    zoomIn,
    zoomOut,
    resetView,
    setScale,
    setPan,
    isDragging: isDraggingState,
  };
}

export default useCanvasInteraction;
