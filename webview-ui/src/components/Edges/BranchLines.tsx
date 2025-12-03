/**
 * Branch Lines Component
 *
 * Renders horizontal branch lines from branching nodes (Decision, Wait, Loop, Start).
 * Based on Salesforce's branch connector patterns.
 */

import React from "react";
import type { FlowNode, FlowEdge } from "../../types";
import {
  // NODE_WIDTH,
  // GRID_H_GAP,
  CONNECTOR_COLORS,
  CONNECTOR_WIDTHS,
} from "../../constants";
import {
  getBranchEdgesForNode,
  isBranchingNode,
  sortBranchEdges,
} from "../../utils/graph";
import { ConnectorPathService } from "../../services";
import { EdgeLabel } from "./EdgeLabel";

// COL_WIDTH is no longer needed as we use dynamic target positioning
// const COL_WIDTH = NODE_WIDTH + GRID_H_GAP;

export interface BranchLineInfo {
  sourceId: string;
  branchLineY: number;
  minX: number;
  maxX: number;
  branches: {
    edge: FlowEdge;
    branchX: number;
    targetX: number;
    targetY: number;
  }[];
}

export interface BranchLinesProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId?: string;
  animateFlow?: boolean;
  highlightedPath?: Set<string>;
  onEdgeClick?: (edgeId: string) => void;
}

/**
 * Calculate branch line information for all branching nodes
 */
export function calculateBranchLines(
  nodes: FlowNode[],
  edges: FlowEdge[]
): BranchLineInfo[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, FlowEdge[]>();

  edges.forEach((edge) => {
    const list = edgesBySource.get(edge.source) || [];
    list.push(edge);
    edgesBySource.set(edge.source, list);
  });

  const branchLines: BranchLineInfo[] = [];

  nodes.forEach((srcNode) => {
    const srcEdges = edgesBySource.get(srcNode.id) || [];
    const branchEdges = sortBranchEdges(
      srcNode,
      getBranchEdgesForNode(srcNode, srcEdges)
    );

    const branching = isBranchingNode(srcNode, branchEdges.length);
    if (!branching) return;

    if (srcNode.type !== "LOOP" && branchEdges.length < 2) {
      return;
    }

    if (srcNode.type === "LOOP" && branchEdges.length < 2) {
      return;
    }

    const srcBottomY = srcNode.y + srcNode.height;
    // Extra offset for START nodes with scheduled paths (they need more room for labels)
    const branchOffset = srcNode.type === "START" ? 55 : 45;
    const branchLineY = srcBottomY + branchOffset;

    // Calculate branch spread positions
    // Calculate branch spread positions
    // numBranches is no longer needed
    // const numBranches = branchEdges.length;
    // startX is no longer needed as we use targetX directly
    // const startX = srcCenterX - totalWidth / 2 + COL_WIDTH / 2;

    const branches = branchEdges
      .map((edge) => {
        const tgt = nodeMap.get(edge.target);
        if (!tgt) return null;

        // Use target's center X for the branch drop point
        // This ensures the vertical drop line is perfectly straight
        // The horizontal branch line will naturally expand to cover the full width
        const targetX = tgt.x + tgt.width / 2;
        
        return {
          edge,
          branchX: targetX,
          targetX: targetX,
          targetY: tgt.y,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    if (branches.length > 0) {
      const branchXs = branches.map((b) => b.branchX);

      branchLines.push({
        sourceId: srcNode.id,
        branchLineY,
        minX: Math.min(...branchXs),
        maxX: Math.max(...branchXs),
        branches,
      });
    }
  });

  return branchLines;
}

/**
 * Get set of edge IDs handled by branch lines
 */
export function getHandledBranchEdges(
  branchLines: BranchLineInfo[]
): Set<string> {
  const set = new Set<string>();
  branchLines.forEach((bl) => {
    bl.branches.forEach((b) => set.add(b.edge.id));
  });
  return set;
}

/**
 * Renders branch lines for all branching nodes
 */
export const BranchLines: React.FC<BranchLinesProps> = ({
  nodes,
  edges,
  selectedNodeId,
  animateFlow,
  highlightedPath,
  onEdgeClick,
}) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const branchLines = calculateBranchLines(nodes, edges);
  const elements: JSX.Element[] = [];

  branchLines.forEach((bl) => {
    const srcNode = nodeMap.get(bl.sourceId);
    if (!srcNode) return;

    const srcCenterX = srcNode.x + srcNode.width / 2;
    const srcBottomY = srcNode.y + srcNode.height;

    // Check if any branch edges are in the highlighted path
    const anyBranchInPath = bl.branches.some((b) =>
      highlightedPath?.has(b.edge.id)
    );

    const branchHighlighted =
      anyBranchInPath ||
      selectedNodeId === bl.sourceId ||
      bl.branches.some((b) => b.edge.target === selectedNodeId);

    const branchStrokeColor = branchHighlighted
      ? CONNECTOR_COLORS.highlight
      : CONNECTOR_COLORS.default;
    const branchStrokeWidth = branchHighlighted
      ? CONNECTOR_WIDTHS.highlight
      : CONNECTOR_WIDTHS.default;

    // Horizontal branch line - full line for visual
    const horizontalPath = ConnectorPathService.createHorizontalLine(
      bl.branchLineY,
      bl.minX,
      bl.maxX
    );
    elements.push(
      <path
        key={`branch-line-${bl.sourceId}`}
        d={horizontalPath}
        fill="none"
        stroke={branchStrokeColor}
        strokeWidth={branchStrokeWidth}
      />
    );

    // Animated overlays - split into left and right from center
    if (animateFlow) {
      // Left segment (center to left) - animate leftward (reverse)
      if (bl.minX < srcCenterX) {
        const leftPath = ConnectorPathService.createHorizontalLine(
          bl.branchLineY,
          srcCenterX,
          bl.minX
        );
        elements.push(
          <path
            key={`branch-line-anim-left-${bl.sourceId}`}
            d={leftPath}
            className="flow-animated-path"
          />
        );
      }
      // Right segment (center to right) - animate rightward (forward)
      if (bl.maxX > srcCenterX) {
        const rightPath = ConnectorPathService.createHorizontalLine(
          bl.branchLineY,
          srcCenterX,
          bl.maxX
        );
        elements.push(
          <path
            key={`branch-line-anim-right-${bl.sourceId}`}
            d={rightPath}
            className="flow-animated-path"
          />
        );
      }
    }

    // Vertical stem from source
    const stemPath = ConnectorPathService.createVerticalLine(
      srcCenterX,
      srcBottomY,
      bl.branchLineY
    );
    elements.push(
      <path
        key={`branch-stem-${bl.sourceId}`}
        d={stemPath}
        fill="none"
        stroke={branchStrokeColor}
        strokeWidth={branchStrokeWidth}
      />
    );
    {
      /* Animated overlay for vertical stem */
    }
    if (animateFlow) {
      elements.push(
        <path
          key={`branch-stem-anim-${bl.sourceId}`}
          d={stemPath}
          className="flow-animated-path"
        />
      );
    }

    // Branch drops to targets
    bl.branches.forEach(({ edge, branchX, targetX, targetY }) => {
      const isPathHighlighted = highlightedPath?.has(edge.id) ?? false;
      const dropHighlighted =
        isPathHighlighted ||
        branchHighlighted ||
        edge.target === selectedNodeId;
      const dropStrokeColor = dropHighlighted
        ? CONNECTOR_COLORS.highlight
        : CONNECTOR_COLORS.default;
      const dropStrokeWidth = dropHighlighted
        ? CONNECTOR_WIDTHS.highlight
        : CONNECTOR_WIDTHS.default;
      const dropMarker = dropHighlighted
        ? "url(#arrow-highlight)"
        : "url(#arrow)";

      // Use horizontal-first strategy for LOOP "For Each" branches and START scheduled paths
      // This prevents the unnecessary vertical drop when branches spread horizontally
      const isLoopForEach =
        srcNode.type === "LOOP" && edge.type === "loop-next";
      const isStartScheduledPath =
        srcNode.type === "START" && bl.branches.length > 1;
      const dropStrategy =
        isLoopForEach || isStartScheduledPath ? "horizontal-first" : "auto";

      const path = ConnectorPathService.createBranchDropPath(
        branchX,
        bl.branchLineY,
        { x: targetX, y: targetY },
        { dropStrategy }
      );

      elements.push(
        <g key={`branch-drop-${edge.id}`}>
          {/* Invisible hit area for easier clicking */}
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            style={{ cursor: "pointer", pointerEvents: "stroke" }}
            onClick={() => onEdgeClick?.(edge.id)}
          />
          <path
            d={path}
            fill="none"
            stroke={dropStrokeColor}
            strokeWidth={dropStrokeWidth}
            markerEnd={dropMarker}
            style={{ pointerEvents: "none" }}
          />
          {/* Animated overlay for branch drop */}
          {animateFlow && (
            <path
              d={path}
              className="flow-animated-path"
              style={{ pointerEvents: "none" }}
            />
          )}
          {edge.label && (
            <EdgeLabel
              x={branchX}
              y={bl.branchLineY - 10}
              label={edge.label}
              isHighlighted={dropHighlighted}
            />
          )}
        </g>
      );
    });
  });

  return <>{elements}</>;
};

export default BranchLines;
