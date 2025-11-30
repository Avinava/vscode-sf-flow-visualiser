/**
 * Merge Lines Component
 *
 * Renders horizontal merge lines where multiple branches converge.
 * Based on Salesforce's merge connector patterns.
 */

import React from "react";
import type { FlowNode, FlowEdge } from "../../types";
import { CONNECTOR_COLORS, CONNECTOR_WIDTHS } from "../../constants";
import { ConnectorPathService } from "../../services";

const CORNER_RADIUS = 12;

export interface MergeLineInfo {
  targetId: string;
  mergeLineY: number;
  minX: number;
  maxX: number;
  centerX: number;
  targetY: number;
  sources: {
    edge: FlowEdge;
    x: number;
    y: number;
  }[];
}

export interface MergeLinesProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  handledEdges: Set<string>;
  selectedNodeId?: string;
  animateFlow?: boolean;
}

/**
 * Calculate merge line information for nodes with multiple incoming edges
 */
export function calculateMergeLines(
  nodes: FlowNode[],
  edges: FlowEdge[],
  handledEdges: Set<string>
): MergeLineInfo[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgesByTarget = new Map<string, FlowEdge[]>();

  edges.forEach((edge) => {
    const list = edgesByTarget.get(edge.target) || [];
    list.push(edge);
    edgesByTarget.set(edge.target, list);
  });

  const mergeLines: MergeLineInfo[] = [];

  nodes.forEach((tgtNode) => {
    // Skip loop nodes - they have loop-back edges that shouldn't be merged
    if (tgtNode.type === "LOOP") return;

    const tgtCenterX = tgtNode.x + tgtNode.width / 2;
    const tgtTopY = tgtNode.y;

    const incomingEdges = (edgesByTarget.get(tgtNode.id) || []).filter((e) => {
      if (e.type === "fault" || e.type === "fault-end") return false;
      if (handledEdges.has(e.id)) return false;

      // Exclude loop-back edges (source is below target)
      const src = nodeMap.get(e.source);
      if (src && src.y + src.height > tgtTopY) {
        return false;
      }

      return true;
    });

    if (incomingEdges.length < 2) return;

    const mergeLineY = tgtTopY - 35;

    // Get source positions
    const sources = incomingEdges
      .map((edge) => {
        const src = nodeMap.get(edge.source);
        if (!src) return null;
        return {
          edge,
          x: src.x + src.width / 2,
          y: src.y + src.height,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    // Check if all sources are at the same Y level
    const sourceYs = new Set(sources.map((s) => Math.round(s.y / 10) * 10));
    if (sourceYs.size !== 1 || sources.length < 2) return;

    const xs = sources.map((s) => s.x);

    mergeLines.push({
      targetId: tgtNode.id,
      mergeLineY,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      centerX: tgtCenterX,
      targetY: tgtTopY,
      sources,
    });
  });

  return mergeLines;
}

/**
 * Get set of edge IDs handled by merge lines
 */
export function getHandledMergeEdges(mergeLines: MergeLineInfo[]): Set<string> {
  const set = new Set<string>();
  mergeLines.forEach((ml) => {
    ml.sources.forEach((s) => set.add(s.edge.id));
  });
  return set;
}

/**
 * Renders merge lines for nodes with multiple incoming edges
 */
export const MergeLines: React.FC<MergeLinesProps> = ({
  nodes,
  edges,
  handledEdges,
  selectedNodeId,
  animateFlow,
}) => {
  const mergeLines = calculateMergeLines(nodes, edges, handledEdges);
  const elements: JSX.Element[] = [];

  mergeLines.forEach((ml) => {
    const mergeHighlighted =
      selectedNodeId === ml.targetId ||
      ml.sources.some((s) => s.edge.source === selectedNodeId);

    const mergeStrokeColor = mergeHighlighted
      ? CONNECTOR_COLORS.highlight
      : CONNECTOR_COLORS.default;
    const mergeStrokeWidth = mergeHighlighted
      ? CONNECTOR_WIDTHS.highlight
      : CONNECTOR_WIDTHS.default;

    // Horizontal merge line
    const horizontalPath = ConnectorPathService.createHorizontalLine(
      ml.mergeLineY,
      ml.minX,
      ml.maxX
    );
    elements.push(
      <path
        key={`merge-line-${ml.targetId}`}
        d={horizontalPath}
        fill="none"
        stroke={mergeStrokeColor}
        strokeWidth={mergeStrokeWidth}
      />
    );
    {
      /* Animated overlay for horizontal merge line */
    }
    if (animateFlow) {
      elements.push(
        <path
          key={`merge-line-anim-${ml.targetId}`}
          d={horizontalPath}
          className="flow-animated-path"
        />
      );
    }

    // Vertical drop to target
    const stemPath = ConnectorPathService.createVerticalLine(
      ml.centerX,
      ml.mergeLineY,
      ml.targetY
    );
    elements.push(
      <path
        key={`merge-stem-${ml.targetId}`}
        d={stemPath}
        fill="none"
        stroke={mergeStrokeColor}
        strokeWidth={mergeStrokeWidth}
        markerEnd={mergeHighlighted ? "url(#arrow-highlight)" : "url(#arrow)"}
      />
    );
    {
      /* Animated overlay for vertical drop */
    }
    if (animateFlow) {
      elements.push(
        <path
          key={`merge-stem-anim-${ml.targetId}`}
          d={stemPath}
          className="flow-animated-path"
        />
      );
    }

    // Source connections to merge line
    ml.sources.forEach(({ edge, x, y }) => {
      const dx = ml.centerX - x;
      const sourceHighlighted = edge.source === selectedNodeId;
      const sourceStrokeColor = sourceHighlighted
        ? CONNECTOR_COLORS.highlight
        : CONNECTOR_COLORS.default;
      const sourceStrokeWidth = sourceHighlighted
        ? CONNECTOR_WIDTHS.highlight
        : CONNECTOR_WIDTHS.default;

      let path: string;
      if (Math.abs(dx) < 5) {
        path = ConnectorPathService.createVerticalLine(x, y, ml.mergeLineY);
      } else {
        path = ConnectorPathService.createMergeRisePath(
          { x, y },
          x, // Rise straight up to merge line at source's X
          ml.mergeLineY,
          { cornerRadius: CORNER_RADIUS }
        );
      }

      elements.push(
        <path
          key={`merge-drop-${edge.id}`}
          d={path}
          fill="none"
          stroke={sourceStrokeColor}
          strokeWidth={sourceStrokeWidth}
        />
      );
      {
        /* Animated overlay for source connection */
      }
      if (animateFlow) {
        elements.push(
          <path
            key={`merge-drop-anim-${edge.id}`}
            d={path}
            className="flow-animated-path"
          />
        );
      }
    });
  });

  return <>{elements}</>;
};

export default MergeLines;
