/**
 * Direct Edges Component
 *
 * Renders edges that aren't handled by BranchLines or MergeLines.
 * Includes fault paths, loop-back connectors, and simple linear edges.
 */

import React, { useMemo } from "react";
import type { FlowNode, FlowEdge } from "../../types";
import { CONNECTOR_COLORS, CONNECTOR_WIDTHS } from "../../constants";
import { ConnectorPathService } from "../../services";
import { EdgeLabel } from "./EdgeLabel";
import { calculateBranchLines, BranchLineInfo } from "./BranchLines";

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
 * Renders a subtle fault path animation - single traveling red dot
 */
const FaultPathAnimation: React.FC<{ path: string }> = ({ path }) => (
  <circle r="3" fill={CONNECTOR_COLORS.fault} filter="url(#fault-spark-glow)">
    <animateMotion dur="2s" repeatCount="indefinite" path={path} />
  </circle>
);

/**
 * Renders full loop cycle animation - traveling blue dot that goes through the entire loop
 * @param path - Combined SVG path for the entire loop cycle
 * @param duration - Animation duration in seconds (based on path length)
 */
const LoopCycleAnimation: React.FC<{ path: string; duration: number }> = ({
  path,
  duration,
}) => (
  <circle
    r="3"
    fill={CONNECTOR_COLORS.highlight}
    filter="url(#loop-spark-glow)"
  >
    <animateMotion
      dur={`${duration}s`}
      repeatCount="indefinite"
      path={path}
      rotate="auto"
    />
  </circle>
);

/**
 * Append an SVG path segment ensuring only the first segment keeps its Move command
 */
function appendPathSegment(base: string, segment: string): string {
  const trimmed = segment.trim().replace(/\s+/g, " ");
  if (!trimmed) return base;
  if (!base) {
    return trimmed;
  }

  return `${base} ${trimmed.replace(/^M\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/, "L $1 $2")}`;
}

/**
 * Find all loop cycles in the flow and build complete circuit paths
 * Uses the pre-calculated branch line data for perfect alignment
 */
function findLoopCycles(
  nodes: FlowNode[],
  edges: FlowEdge[],
  branchLines: BranchLineInfo[]
): Array<{ loopNodeId: string; cyclePath: string; duration: number }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgesBySource = new Map<string, FlowEdge[]>();
  const edgesByTarget = new Map<string, FlowEdge[]>();

  edges.forEach((edge) => {
    const srcList = edgesBySource.get(edge.source) || [];
    srcList.push(edge);
    edgesBySource.set(edge.source, srcList);

    const tgtList = edgesByTarget.get(edge.target) || [];
    tgtList.push(edge);
    edgesByTarget.set(edge.target, tgtList);
  });

  const loopCycles: Array<{
    loopNodeId: string;
    cyclePath: string;
    duration: number;
  }> = [];

  const r = 12; // corner radius

  // Find all loop nodes
  const loopNodes = nodes.filter((n) => n.type === "LOOP");

  loopNodes.forEach((loopNode) => {
    // Find the branch line info for this loop node
    const branchLine = branchLines.find((bl) => bl.sourceId === loopNode.id);
    if (!branchLine) return;

    // Find the "For Each" branch in the pre-calculated branch data
    const forEachBranch = branchLine.branches.find(
      (b) => b.edge.type === "loop-next"
    );
    if (!forEachBranch) return;

    // Find the loop-back edge (edge targeting this loop node from below)
    const incomingEdges = edgesByTarget.get(loopNode.id) || [];
    const loopBackEdge = incomingEdges.find((e) => {
      const src = nodeMap.get(e.source);
      if (!src) return false;
      return src.y + src.height > loopNode.y + loopNode.height;
    });
    if (!loopBackEdge) return;

    let totalLength = 0;

    // Use pre-calculated values from branchLine
    const loopCenterX = loopNode.x + loopNode.width / 2;
    const loopBottomY = loopNode.y + loopNode.height;
    const branchLineY = branchLine.branchLineY;
    const forEachBranchX = forEachBranch.branchX;
    const firstNodeCenterX = forEachBranch.targetX;
    const firstNodeTopY = forEachBranch.targetY;

    // Build path using exact connector path helpers for perfect alignment
    let pathD = "";

    // 1. Vertical stem down to branch line
    const stemPath = ConnectorPathService.createVerticalLine(
      loopCenterX,
      loopBottomY,
      branchLineY
    );
    pathD = appendPathSegment(pathD, stemPath);
    totalLength += Math.abs(branchLineY - loopBottomY);

    // 2. Horizontal segment along branch line to the loop-next branchX
    if (Math.abs(forEachBranchX - loopCenterX) > 1) {
      const horizontalPath = ConnectorPathService.createHorizontalLine(
        branchLineY,
        loopCenterX,
        forEachBranchX
      );
      pathD = appendPathSegment(pathD, horizontalPath);
      totalLength += Math.abs(forEachBranchX - loopCenterX);
    }

    // 3. Branch drop using the same helper as renderer
    const branchDropPath = ConnectorPathService.createBranchDropPath(
      forEachBranchX,
      branchLineY,
      { x: firstNodeCenterX, y: firstNodeTopY },
      { dropStrategy: "horizontal-first" }
    );
    pathD = appendPathSegment(pathD, branchDropPath);
    totalLength +=
      Math.abs(firstNodeTopY - branchLineY) +
      Math.abs(firstNodeCenterX - forEachBranchX);

    // 4. Trace through the loop body nodes
    let currentNodeId = forEachBranch.edge.target;
    let prevX = firstNodeCenterX;
    let prevY = firstNodeTopY;
    const visited = new Set<string>();
    let iterations = 0;
    const maxIterations = 50;

    while (
      currentNodeId &&
      currentNodeId !== loopNode.id &&
      iterations < maxIterations
    ) {
      iterations++;
      if (visited.has(currentNodeId)) break;
      visited.add(currentNodeId);

      const currentNode = nodeMap.get(currentNodeId);
      if (!currentNode) break;

      const currCenterX = currentNode.x + currentNode.width / 2;
      const currBottomY = currentNode.y + currentNode.height;

      // Through the node (top to bottom)
      pathD += ` L ${currCenterX} ${currBottomY}`;
      totalLength += currentNode.height;

      prevX = currCenterX;
      prevY = currBottomY;

      // Find next node in the loop body
      const outgoingEdges = edgesBySource.get(currentNodeId) || [];
      let nextEdge = outgoingEdges.find(
        (e) => e.target !== loopNode.id && nodeMap.has(e.target)
      );
      if (!nextEdge) {
        nextEdge = outgoingEdges.find((e) => e.target === loopNode.id);
      }
      if (!nextEdge) break;

      const nextNode = nodeMap.get(nextEdge.target);
      if (!nextNode) break;
      if (nextEdge.target === loopNode.id) break;

      const nextCenterX = nextNode.x + nextNode.width / 2;
      const nextTopY = nextNode.y;

      // Path from current bottom to next top
      if (Math.abs(nextCenterX - prevX) < 5) {
        pathD += ` L ${nextCenterX} ${nextTopY}`;
        totalLength += Math.abs(nextTopY - prevY);
      } else {
        const bendY = prevY + Math.min(35, (nextTopY - prevY) / 2);
        const sign = nextCenterX > prevX ? 1 : -1;

        pathD += ` L ${prevX} ${bendY - r}`;
        pathD += ` Q ${prevX} ${bendY}, ${prevX + sign * r} ${bendY}`;
        pathD += ` L ${nextCenterX - sign * r} ${bendY}`;
        pathD += ` Q ${nextCenterX} ${bendY}, ${nextCenterX} ${bendY + r}`;
        pathD += ` L ${nextCenterX} ${nextTopY}`;

        totalLength +=
          Math.abs(bendY - prevY) +
          Math.abs(nextCenterX - prevX) +
          Math.abs(nextTopY - bendY);
      }

      currentNodeId = nextEdge.target;
    }

    // 5. Loop-back path from last body node to loop node top
    const loopBackSrc = nodeMap.get(loopBackEdge.source);
    if (loopBackSrc) {
      const srcCenterX = loopBackSrc.x + loopBackSrc.width / 2;
      const srcBottomY = loopBackSrc.y + loopBackSrc.height;
      const tgtCenterX = loopNode.x + loopNode.width / 2;
      const tgtTopY = loopNode.y;

      // Loop-back geometry matching createLoopBackPath
      const minX = Math.min(srcCenterX, tgtCenterX);
      const offsetX = Math.max(60, Math.abs(srcCenterX - tgtCenterX) / 2 + 50);
      const leftX = minX - offsetX;
      const bottomY = srcBottomY + 30;
      const topY = tgtTopY - 15;
      const loopR = Math.min(20, Math.abs(bottomY - topY) / 4, offsetX / 2);

      pathD += ` L ${srcCenterX} ${bottomY - loopR}`;
      pathD += ` Q ${srcCenterX} ${bottomY}, ${srcCenterX - loopR} ${bottomY}`;
      pathD += ` L ${leftX + loopR} ${bottomY}`;
      pathD += ` Q ${leftX} ${bottomY}, ${leftX} ${bottomY - loopR}`;
      pathD += ` L ${leftX} ${topY + loopR}`;
      pathD += ` Q ${leftX} ${topY}, ${leftX + loopR} ${topY}`;
      pathD += ` L ${tgtCenterX - loopR} ${topY}`;
      pathD += ` Q ${tgtCenterX} ${topY}, ${tgtCenterX} ${topY + loopR}`;
      pathD += ` L ${tgtCenterX} ${tgtTopY}`;

      totalLength +=
        30 +
        Math.abs(srcCenterX - leftX) +
        Math.abs(bottomY - topY) +
        Math.abs(tgtCenterX - leftX) +
        15;
    }

    const duration = Math.max(4, Math.min(10, totalLength / 150));

    loopCycles.push({
      loopNodeId: loopNode.id,
      cyclePath: pathD,
      duration,
    });
  });

  return loopCycles;
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

  // Calculate branch lines (same as BranchLines component)
  const branchLines = useMemo(
    () => calculateBranchLines(nodes, edges),
    [nodes, edges]
  );

  // Calculate loop cycles for full circuit animation using pre-calculated branch lines
  const loopCycles = useMemo(
    () => (animateFlow ? findLoopCycles(nodes, edges, branchLines) : []),
    [nodes, edges, branchLines, animateFlow]
  );

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
      markerEnd = animateFlow ? "url(#arrow-red-animated)" : "url(#arrow-red)";
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
        {/* Fault path animations - subtle glow and traveling spark */}
        {animateFlow && showAsRed && <FaultPathAnimation path={path} />}
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

  // Add loop cycle animations
  loopCycles.forEach((cycle) => {
    elements.push(
      <LoopCycleAnimation
        key={`loop-cycle-${cycle.loopNodeId}`}
        path={cycle.cyclePath}
        duration={cycle.duration}
      />
    );
  });

  return <>{elements}</>;
};

export default DirectEdges;
