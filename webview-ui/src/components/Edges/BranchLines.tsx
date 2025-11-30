/**
 * Branch Lines Component
 *
 * Renders horizontal branch lines from branching nodes (Decision, Wait, Loop, Start).
 * Based on Salesforce's branch connector patterns.
 */

import React from "react";
import type { FlowNode, FlowEdge } from "../../types";
import {
  NODE_WIDTH,
  GRID_H_GAP,
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

const COL_WIDTH = NODE_WIDTH + GRID_H_GAP;

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

    const srcCenterX = srcNode.x + srcNode.width / 2;
    const srcBottomY = srcNode.y + srcNode.height;
    const branchLineY = srcBottomY + 35;

    // Calculate branch spread positions
    const numBranches = branchEdges.length;
    const totalWidth = numBranches * COL_WIDTH;
    const startX = srcCenterX - totalWidth / 2 + COL_WIDTH / 2;

    const branches = branchEdges
      .map((edge, idx) => {
        const tgt = nodeMap.get(edge.target);
        if (!tgt) return null;

        return {
          edge,
          branchX: startX + idx * COL_WIDTH,
          targetX: tgt.x + tgt.width / 2,
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
}) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const branchLines = calculateBranchLines(nodes, edges);
  const elements: JSX.Element[] = [];

  branchLines.forEach((bl) => {
    const srcNode = nodeMap.get(bl.sourceId);
    if (!srcNode) return;

    const srcCenterX = srcNode.x + srcNode.width / 2;
    const srcBottomY = srcNode.y + srcNode.height;

    const branchHighlighted =
      selectedNodeId === bl.sourceId ||
      bl.branches.some((b) => b.edge.target === selectedNodeId);

    const branchStrokeColor = branchHighlighted
      ? CONNECTOR_COLORS.highlight
      : CONNECTOR_COLORS.default;
    const branchStrokeWidth = branchHighlighted
      ? CONNECTOR_WIDTHS.highlight
      : CONNECTOR_WIDTHS.default;

    // Horizontal branch line
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
    {
      /* Animated overlay for horizontal branch line */
    }
    if (animateFlow) {
      elements.push(
        <path
          key={`branch-line-anim-${bl.sourceId}`}
          d={horizontalPath}
          className="flow-animated-path"
        />
      );
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
      const dropHighlighted =
        branchHighlighted || edge.target === selectedNodeId;
      const dropStrokeColor = dropHighlighted
        ? CONNECTOR_COLORS.highlight
        : CONNECTOR_COLORS.default;
      const dropStrokeWidth = dropHighlighted
        ? CONNECTOR_WIDTHS.highlight
        : CONNECTOR_WIDTHS.default;
      const dropMarker = dropHighlighted
        ? "url(#arrow-highlight)"
        : "url(#arrow)";

      const path = ConnectorPathService.createBranchDropPath(
        branchX,
        bl.branchLineY,
        { x: targetX, y: targetY }
      );

      elements.push(
        <g key={`branch-drop-${edge.id}`}>
          <path
            d={path}
            fill="none"
            stroke={dropStrokeColor}
            strokeWidth={dropStrokeWidth}
            markerEnd={dropMarker}
          />
          {/* Animated overlay for branch drop */}
          {animateFlow && <path d={path} className="flow-animated-path" />}
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
