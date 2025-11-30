/**
 * Edge Selection Hook
 *
 * Manages edge selection state and calculates the flow path
 * from the selected edge through downstream nodes.
 */

import { useState, useCallback, useMemo } from "react";
import type { FlowNode, FlowEdge } from "../types";

export interface UseEdgeSelectionOptions {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface UseEdgeSelectionResult {
  selectedEdgeId: string | null;
  highlightedPath: Set<string>; // Set of edge IDs in the flow path
  highlightedNodes: Set<string>; // Set of node IDs in the flow path
  selectEdge: (edgeId: string) => void;
  clearEdgeSelection: () => void;
}

/**
 * Hook for edge selection and flow path highlighting
 */
export function useEdgeSelection(
  options: UseEdgeSelectionOptions
): UseEdgeSelectionResult {
  const { edges } = options;
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Build lookup maps
  const edgeMap = useMemo(() => new Map(edges.map((e) => [e.id, e])), [edges]);

  const edgesBySource = useMemo(() => {
    const map = new Map<string, FlowEdge[]>();
    edges.forEach((edge) => {
      const list = map.get(edge.source) || [];
      list.push(edge);
      map.set(edge.source, list);
    });
    return map;
  }, [edges]);

  // Calculate the flow path from selected edge
  const { highlightedPath, highlightedNodes } = useMemo(() => {
    const pathEdges = new Set<string>();
    const pathNodes = new Set<string>();

    if (!selectedEdgeId) {
      return { highlightedPath: pathEdges, highlightedNodes: pathNodes };
    }

    const selectedEdge = edgeMap.get(selectedEdgeId);
    if (!selectedEdge) {
      return { highlightedPath: pathEdges, highlightedNodes: pathNodes };
    }

    // Add the selected edge
    pathEdges.add(selectedEdgeId);
    pathNodes.add(selectedEdge.source);
    pathNodes.add(selectedEdge.target);

    // BFS to find all downstream edges and nodes
    const visited = new Set<string>();
    const queue: string[] = [selectedEdge.target];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoingEdges = edgesBySource.get(nodeId) || [];
      for (const edge of outgoingEdges) {
        // Skip fault paths for cleaner visualization
        if (edge.type === "fault" || edge.type === "fault-end") continue;

        pathEdges.add(edge.id);
        pathNodes.add(edge.target);

        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return { highlightedPath: pathEdges, highlightedNodes: pathNodes };
  }, [selectedEdgeId, edgeMap, edgesBySource]);

  const selectEdge = useCallback((edgeId: string) => {
    setSelectedEdgeId((prev) => (prev === edgeId ? null : edgeId));
  }, []);

  const clearEdgeSelection = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  return {
    selectedEdgeId,
    highlightedPath,
    highlightedNodes,
    selectEdge,
    clearEdgeSelection,
  };
}

export default useEdgeSelection;
