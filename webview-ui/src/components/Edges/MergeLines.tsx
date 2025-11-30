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
  highlightedPath?: Set<string>;
  onEdgeClick?: (edgeId: string) => void;
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
  highlightedPath,
  onEdgeClick,
}) => {
  const mergeLines = calculateMergeLines(nodes, edges, handledEdges);
  const elements: JSX.Element[] = [];

  mergeLines.forEach((ml) => {
    // Check if any source edges are in the highlighted path
    const anySourceInPath = ml.sources.some((s) =>
      highlightedPath?.has(s.edge.id)
    );

    const mergeHighlighted =
      anySourceInPath ||
      selectedNodeId === ml.targetId ||
      ml.sources.some((s) => s.edge.source === selectedNodeId);

    const mergeStrokeColor = mergeHighlighted
      ? CONNECTOR_COLORS.highlight
      : CONNECTOR_COLORS.default;
    const mergeStrokeWidth = mergeHighlighted
      ? CONNECTOR_WIDTHS.highlight
      : CONNECTOR_WIDTHS.default;

    // Horizontal merge line - full line for visual
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

    // Animated overlays - split into left and right, flowing INWARD to center
    if (animateFlow) {
      // Left segment (left to center) - animate rightward (forward direction since path goes left-to-right)
      if (ml.minX < ml.centerX) {
        const leftPath = ConnectorPathService.createHorizontalLine(
          ml.mergeLineY,
          ml.minX,
          ml.centerX
        );
        elements.push(
          <path
            key={`merge-line-anim-left-${ml.targetId}`}
            d={leftPath}
            className="flow-animated-path"
          />
        );
      }
      // Right segment (right to center) - animate leftward (reverse since path goes center-to-right but we want right-to-center)
      if (ml.maxX > ml.centerX) {
        const rightPath = ConnectorPathService.createHorizontalLine(
          ml.mergeLineY,
          ml.maxX,
          ml.centerX
        );
        elements.push(
          <path
            key={`merge-line-anim-right-${ml.targetId}`}
            d={rightPath}
            className="flow-animated-path"
          />
        );
      }
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
      const isPathHighlighted = highlightedPath?.has(edge.id) ?? false;
      const sourceHighlighted =
        isPathHighlighted || edge.source === selectedNodeId;
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
        <g key={`merge-drop-${edge.id}`}>
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
            stroke={sourceStrokeColor}
            strokeWidth={sourceStrokeWidth}
            style={{ pointerEvents: "none" }}
          />
          {/* Animated overlay for source connection */}
          {animateFlow && (
            <path
              d={path}
              className="flow-animated-path"
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      );
    });
  });

  return <>{elements}</>;
};

export default MergeLines;
