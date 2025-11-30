/**
 * Canvas Interaction Hook
 *
 * Handles pan, zoom, and drag interactions for the flow canvas.
 * Provides smooth canvas navigation with mouse, wheel, and keyboard controls.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
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
  /** Callback to get node bounds for fit-to-view */
  getNodeBounds?: () => BoundingBox | null;
  /** Callback to toggle theme */
  onToggleTheme?: () => void;
  /** Callback to toggle animation */
  onToggleAnimation?: () => void;
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
  /** Fit all nodes in view */
  fitToView: () => void;
  /** Set scale directly */
  setScale: (scale: number) => void;
  /** Set pan directly */
  setPan: (pan: Point) => void;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Set node bounds getter for fit-to-view */
  setNodeBoundsGetter: (getter: () => BoundingBox | null) => void;
}

const DEFAULT_OPTIONS: Required<
  Omit<
    UseCanvasInteractionOptions,
    "getNodeBounds" | "onToggleTheme" | "onToggleAnimation"
  >
> = {
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
  const nodeBoundsGetterRef = useRef<(() => BoundingBox | null) | null>(
    options.getNodeBounds || null
  );
  const onToggleThemeRef = useRef(options.onToggleTheme);
  const onToggleAnimationRef = useRef(options.onToggleAnimation);

  // Update theme toggle ref when it changes
  useEffect(() => {
    onToggleThemeRef.current = options.onToggleTheme;
  }, [options.onToggleTheme]);

  // Update animation toggle ref when it changes
  useEffect(() => {
    onToggleAnimationRef.current = options.onToggleAnimation;
  }, [options.onToggleAnimation]);

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

  // Fit all nodes to view
  const fitToView = useCallback(() => {
    const getBounds = nodeBoundsGetterRef.current;
    if (!getBounds) {
      resetView();
      return;
    }

    const bounds = getBounds();
    if (!bounds) {
      resetView();
      return;
    }

    // Get viewport dimensions (approximate, assuming full canvas area)
    const viewportWidth = window.innerWidth - 320; // Subtract sidebar width
    const viewportHeight = window.innerHeight - 60; // Subtract header height
    const padding = 100; // Padding around content

    // Calculate scale to fit content
    const scaleX = (viewportWidth - padding * 2) / bounds.width;
    const scaleY = (viewportHeight - padding * 2) / bounds.height;
    const newScale = clampScale(Math.min(scaleX, scaleY, 1)); // Don't zoom in beyond 100%

    // Calculate pan to center content
    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;

    // Calculate pan needed to center the content
    const panX = viewportWidth / 2 - centerX * newScale + 160; // Offset for sidebar
    const panY = viewportHeight / 2 - centerY * newScale + 30;

    setScaleState(newScale);
    setPanState({ x: panX, y: panY });
  }, [clampScale, resetView]);

  // Set node bounds getter
  const setNodeBoundsGetter = useCallback(
    (getter: () => BoundingBox | null) => {
      nodeBoundsGetterRef.current = getter;
    },
    []
  );

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          resetView();
          break;
        case "f":
        case "F":
          e.preventDefault();
          fitToView();
          break;
        case "t":
        case "T":
          e.preventDefault();
          if (onToggleThemeRef.current) {
            onToggleThemeRef.current();
          }
          break;
        case "a":
        case "A":
          e.preventDefault();
          if (onToggleAnimationRef.current) {
            onToggleAnimationRef.current();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetView, fitToView]);

  return {
    state: { scale, pan },
    onMouseDown,
    onWheel,
    zoomIn,
    zoomOut,
    resetView,
    fitToView,
    setScale,
    setPan,
    isDragging: isDraggingState,
    setNodeBoundsGetter,
  };
}

export default useCanvasInteraction;
