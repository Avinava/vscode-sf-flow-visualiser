/**
 * Direct Edges Component
 *
 * Renders edges that aren't handled by BranchLines or MergeLines.
 * Includes fault paths, loop-back connectors, and simple linear edges.
 */

import React from "react";
import type { FlowNode, FlowEdge } from "../../types";
import { CONNECTOR_COLORS, CONNECTOR_WIDTHS } from "../../constants";
import { ConnectorPathService } from "../../services";
import { EdgeLabel } from "./EdgeLabel";

export interface DirectEdgesProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  handledEdges: Set<string>;
  selectedNodeId?: string;
  animateFlow?: boolean;
  highlightedPath?: Set<string>;
  onEdgeClick?: (edgeId: string) => void;
}

/**
 * Renders edges not handled by branch lines or merge lines
 */
export const DirectEdges: React.FC<DirectEdgesProps> = ({
  nodes,
  edges,
  handledEdges,
  selectedNodeId,
  animateFlow,
  highlightedPath,
  onEdgeClick,
}) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const elements: JSX.Element[] = [];

  // Group fault edges by source for staggering
  const faultEdgesBySource = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (edge.type === "fault" || edge.type === "fault-end") {
      const list = faultEdgesBySource.get(edge.source) || [];
      list.push(edge);
      faultEdgesBySource.set(edge.source, list);
    }
  });

  edges.forEach((edge) => {
    if (handledEdges.has(edge.id)) return;

    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return;

    const srcCenterX = src.x + src.width / 2;
    const srcBottomY = src.y + src.height;
    const srcRightX = src.x + src.width;
    const srcCenterY = src.y + src.height / 2;

    const tgtCenterX = tgt.x + tgt.width / 2;
    const tgtTopY = tgt.y;
    const tgtLeftX = tgt.x;
    const tgtCenterY = tgt.y + tgt.height / 2;

    const isFault = edge.type === "fault";
    const isFaultEnd = edge.type === "fault-end";
    const isGoTo = edge.isGoTo === true || edge.type === "goto";
    const isLoopBack = !isFault && !isFaultEnd && tgtTopY < srcBottomY;
    const isPathHighlighted = highlightedPath?.has(edge.id) ?? false;
    const isHighlighted =
      isPathHighlighted ||
      (!!selectedNodeId &&
        (edge.source === selectedNodeId || edge.target === selectedNodeId));

    let path: string;
    const showAsRed = isFault || isFaultEnd;
    const showAsBlue = isGoTo && !showAsRed;

    if (isFaultEnd) {
      // Straight horizontal line for fault-end
      path = ConnectorPathService.createStraightPath(
        { x: srcRightX, y: srcCenterY },
        { x: tgtLeftX, y: srcCenterY }
      );
    } else if (isFault) {
      // Get fault index for staggering
      const faultEdges = faultEdgesBySource.get(edge.source) || [];
      const faultIndex = faultEdges.findIndex((e) => e.id === edge.id);

      path = ConnectorPathService.createFaultPath(
        { x: srcRightX, y: srcCenterY },
        { x: tgtLeftX, y: tgtCenterY },
        { faultIndex }
      );
    } else if (isLoopBack) {
      path = ConnectorPathService.createLoopBackPath(
        { x: srcCenterX, y: srcBottomY },
        { x: tgtCenterX, y: tgtTopY }
      );
    } else if (Math.abs(tgtCenterX - srcCenterX) < 5) {
      // Straight vertical line
      path = ConnectorPathService.createStraightPath(
        { x: srcCenterX, y: srcBottomY },
        { x: tgtCenterX, y: tgtTopY }
      );
    } else {
      // Orthogonal routing
      path = ConnectorPathService.createOrthogonalPath(
        { x: srcCenterX, y: srcBottomY },
        { x: tgtCenterX, y: tgtTopY }
      );
    }

    // Calculate label position
    let labelX = (srcCenterX + tgtCenterX) / 2;
    let labelY = srcBottomY + 20;

    if (isFault || isFaultEnd) {
      labelX = (srcRightX + tgtLeftX) / 2;
      labelY = srcCenterY - 12;
    } else if (isLoopBack) {
      // Position loop-back label on the left side of the loop
      const minX = Math.min(srcCenterX, tgtCenterX);
      const offsetX = Math.max(60, Math.abs(srcCenterX - tgtCenterX) / 2 + 50);
      labelX = minX - offsetX - 10;
      labelY = (srcBottomY + tgtTopY) / 2;
    }

    // Determine stroke styling
    let strokeColor = CONNECTOR_COLORS.default;
    let markerEnd = "url(#arrow)";
    let strokeDasharray: string | undefined = undefined;
    let strokeWidth = CONNECTOR_WIDTHS.default;

    if (showAsRed) {
      strokeColor = CONNECTOR_COLORS.fault;
      markerEnd = "url(#arrow-red)";
      strokeDasharray = "6,4";
    } else if (showAsBlue) {
      strokeColor = CONNECTOR_COLORS.goto;
      markerEnd = "url(#arrow-blue)";
      strokeDasharray = "6,4";
    } else if (isLoopBack) {
      // Loop-back connectors use blue dashed style like Salesforce
      strokeColor = CONNECTOR_COLORS.highlight;
      markerEnd = "url(#arrow-highlight)";
      strokeDasharray = "8,4";
    }

    if (isHighlighted) {
      strokeWidth = CONNECTOR_WIDTHS.highlight;
      if (!showAsRed && !showAsBlue) {
        strokeColor = CONNECTOR_COLORS.highlight;
        markerEnd = "url(#arrow-highlight)";
      }
    }

    elements.push(
      <g key={edge.id}>
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
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          markerEnd={markerEnd}
          style={{ pointerEvents: "none" }}
        />
        {/* Animated overlay when animation is enabled */}
        {animateFlow && !showAsRed && !showAsBlue && (
          <path d={path} className="flow-animated-path" />
        )}
        {edge.label && (
          <EdgeLabel
            x={labelX}
            y={labelY}
            label={edge.label}
            isFault={showAsRed}
            isGoTo={showAsBlue}
            isHighlighted={isHighlighted && !showAsRed && !showAsBlue}
          />
        )}
      </g>
    );
  });

  return <>{elements}</>;
};

export default DirectEdges;
