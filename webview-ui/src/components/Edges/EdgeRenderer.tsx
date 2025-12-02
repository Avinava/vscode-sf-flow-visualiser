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
import type { FaultLaneInfo } from "../../layout";
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
import { FlowAnimation } from "./FlowAnimation";
import { useTheme } from "../../context";

export interface EdgeRendererProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId?: string;
  highlightedPath?: Set<string>;
  onEdgeClick?: (edgeId: string) => void;
  /** Pre-calculated fault lane information for consistent connector routing */
  faultLanes?: Map<string, FaultLaneInfo>;
}

/**
 * Main edge renderer that combines all edge types
 */
export const EdgeRenderer: React.FC<EdgeRendererProps> = ({
  nodes,
  edges,
  selectedNodeId,
  highlightedPath,
  onEdgeClick,
  faultLanes,
}) => {
  const { animateFlow } = useTheme();

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
    <svg className="absolute top-0 left-0 w-1 h-1 overflow-visible">
      <EdgeMarkers />
      {animateFlow && <FlowAnimation />}
      <BranchLines
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        animateFlow={animateFlow}
        highlightedPath={highlightedPath}
        onEdgeClick={onEdgeClick}
      />
      <MergeLines
        nodes={nodes}
        edges={edges}
        handledEdges={handledByBranches}
        selectedNodeId={selectedNodeId}
        animateFlow={animateFlow}
        highlightedPath={highlightedPath}
        onEdgeClick={onEdgeClick}
      />
      <DirectEdges
        nodes={nodes}
        edges={edges}
        handledEdges={allHandledEdges}
        selectedNodeId={selectedNodeId}
        animateFlow={animateFlow}
        highlightedPath={highlightedPath}
        onEdgeClick={onEdgeClick}
        faultLanes={faultLanes}
      />
    </svg>
  );
};

export default EdgeRenderer;
