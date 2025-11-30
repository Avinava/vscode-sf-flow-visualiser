/**
 * Edge Renderer Component
 *
 * Main edge rendering component that orchestrates branch lines,
 * merge lines, and direct edges.
 *
 * Based on Salesforce's alcConnector patterns.
 */

import React, { useMemo } from "react";
import type { FlowNode, FlowEdge } from "../../types";
import { EdgeMarkers } from "./EdgeMarkers";
import {
  BranchLines,
  calculateBranchLines,
  getHandledBranchEdges,
} from "./BranchLines";
import {
  MergeLines,
  calculateMergeLines,
  getHandledMergeEdges,
} from "./MergeLines";
import { DirectEdges } from "./DirectEdges";

export interface EdgeRendererProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId?: string;
}

/**
 * Main edge renderer that combines all edge types
 */
export const EdgeRenderer: React.FC<EdgeRendererProps> = ({
  nodes,
  edges,
  selectedNodeId,
}) => {
  // Calculate which edges are handled by branch lines
  const branchLines = useMemo(
    () => calculateBranchLines(nodes, edges),
    [nodes, edges]
  );

  const handledByBranches = useMemo(
    () => getHandledBranchEdges(branchLines),
    [branchLines]
  );

  // Calculate which edges are handled by merge lines
  const mergeLines = useMemo(
    () => calculateMergeLines(nodes, edges, handledByBranches),
    [nodes, edges, handledByBranches]
  );

  const handledByMerges = useMemo(
    () => getHandledMergeEdges(mergeLines),
    [mergeLines]
  );

  // Combine all handled edges
  const allHandledEdges = useMemo(() => {
    const set = new Set(handledByBranches);
    handledByMerges.forEach((id) => set.add(id));
    return set;
  }, [handledByBranches, handledByMerges]);

  return (
    <svg className="absolute top-0 left-0 w-1 h-1 overflow-visible pointer-events-none">
      <EdgeMarkers />
      <BranchLines
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
      />
      <MergeLines
        nodes={nodes}
        edges={edges}
        handledEdges={handledByBranches}
        selectedNodeId={selectedNodeId}
      />
      <DirectEdges
        nodes={nodes}
        edges={edges}
        handledEdges={allHandledEdges}
        selectedNodeId={selectedNodeId}
      />
    </svg>
  );
};

export default EdgeRenderer;
