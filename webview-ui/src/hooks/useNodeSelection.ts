/**
 * Node Selection Hook
 *
 * Manages selection state for flow nodes in the canvas.
 * Handles single selection with optional multi-select support.
 */

import { useState, useCallback } from "react";
import type { FlowNode } from "../types";

export interface UseNodeSelectionOptions {
  /** Callback when selection changes */
  onSelectionChange?: (node: FlowNode | null) => void;
}

export interface UseNodeSelectionResult {
  /** Currently selected node (or null) */
  selectedNode: FlowNode | null;
  /** Select a node */
  selectNode: (node: FlowNode | null) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Check if a specific node is selected */
  isSelected: (nodeId: string) => boolean;
}

/**
 * Hook for managing flow node selection state
 *
 * @param options - Configuration options
 * @returns Selection state and management functions
 */
export function useNodeSelection(
  options: UseNodeSelectionOptions = {}
): UseNodeSelectionResult {
  const { onSelectionChange } = options;

  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  // Select a node
  const selectNode = useCallback(
    (node: FlowNode | null) => {
      setSelectedNode(node);
      onSelectionChange?.(node);
    },
    [onSelectionChange]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  // Check if a node is selected
  const isSelected = useCallback(
    (nodeId: string) => {
      return selectedNode?.id === nodeId;
    },
    [selectedNode]
  );

  return {
    selectedNode,
    selectNode,
    clearSelection,
    isSelected,
  };
}

export default useNodeSelection;
