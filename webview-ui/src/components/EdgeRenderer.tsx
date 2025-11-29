/**
 * Edge Renderer Component
 *
 * Renders SVG connectors between flow nodes following Salesforce's
 * Auto-Layout Canvas patterns.
 *
 * Based on:
 * - alcConnector.js: Connector rendering, SVG paths, styling
 * - alcComponentsUtils.js: Connector utilities, labels
 * - alcStyles.js: Connector CSS styling
 *
 * Key Salesforce patterns implemented:
 * 1. Branch spread lines - horizontal lines from decision nodes
 * 2. Merge lines - where multiple branches converge
 * 3. Orthogonal routing with rounded corners
 * 4. Fault connectors exit horizontally from right side
 * 5. Loop connectors with special routing
 */

import React, { useMemo } from "react";
import type { FlowNode, FlowEdge } from "../types";
import {
  NODE_WIDTH,
  GRID_H_GAP,
  CONNECTOR_COLORS,
  CONNECTOR_WIDTHS,
} from "../constants";

// ============================================================================
// TYPES
// ============================================================================

interface EdgeRendererProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// EdgeRenderInfo interface available for future type-safe edge rendering
// interface EdgeRenderInfo {
//   key: string;
//   edge: FlowEdge;
//   path: string;
//   isFault: boolean;
//   labelPosition?: { x: number; y: number };
// }

// ============================================================================
// CONSTANTS
// ============================================================================

const COL_WIDTH = NODE_WIDTH + GRID_H_GAP;
const CORNER_RADIUS = 12;
const FAULT_HORIZONTAL_OFFSET = 50;

// ============================================================================
// SVG MARKER DEFINITIONS
// ============================================================================

export const EdgeMarkers: React.FC = () => (
  <defs>
    <marker
      id="arrow"
      markerWidth="8"
      markerHeight="6"
      refX="7"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 8 3, 0 6" fill={CONNECTOR_COLORS.default} />
    </marker>
    <marker
      id="arrow-red"
      markerWidth="8"
      markerHeight="6"
      refX="7"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 8 3, 0 6" fill={CONNECTOR_COLORS.fault} />
    </marker>
    <marker
      id="arrow-blue"
      markerWidth="8"
      markerHeight="6"
      refX="7"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 8 3, 0 6" fill={CONNECTOR_COLORS.goto} />
    </marker>
    <marker
      id="arrow-highlight"
      markerWidth="8"
      markerHeight="6"
      refX="7"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 8 3, 0 6" fill={CONNECTOR_COLORS.highlight} />
    </marker>
  </defs>
);

// ============================================================================
// EDGE LABEL COMPONENT
// ============================================================================

interface EdgeLabelProps {
  x: number;
  y: number;
  label: string;
  isFault?: boolean;
}

const EdgeLabel: React.FC<EdgeLabelProps> = ({ x, y, label, isFault }) => (
  <foreignObject
    x={x - 60}
    y={y - 12}
    width={120}
    height={24}
    style={{ overflow: "visible" }}
  >
    <div
      className={`text-[10px] px-2 py-0.5 rounded-full text-center truncate border shadow-sm mx-auto
        ${
          isFault
            ? "bg-red-500 text-white border-red-600 font-medium"
            : "bg-white text-slate-600 border-slate-200 max-w-[110px]"
        }`}
    >
      {label}
    </div>
  </foreignObject>
);

// ============================================================================
// PATH GENERATION UTILITIES
// ============================================================================

/**
 * Generate an orthogonal path with rounded corners
 */
function createOrthogonalPath(
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  cornerRadius: number = CORNER_RADIUS
): string {
  const dx = tgtX - srcX;

  if (Math.abs(dx) < 5) {
    // Straight vertical line
    return `M ${srcX} ${srcY} L ${tgtX} ${tgtY}`;
  }

  const sign = dx > 0 ? 1 : -1;
  const midY = srcY + (tgtY - srcY) / 2;

  if (Math.abs(tgtY - srcY) < 40) {
    // Short vertical distance - use smaller curves
    return `M ${srcX} ${srcY} 
            L ${srcX} ${srcY + 15}
            Q ${srcX} ${srcY + 25}, ${srcX + sign * 10} ${srcY + 25}
            L ${tgtX - sign * 10} ${srcY + 25}
            Q ${tgtX} ${srcY + 25}, ${tgtX} ${srcY + 35}
            L ${tgtX} ${tgtY}`;
  }

  return `M ${srcX} ${srcY} 
          L ${srcX} ${midY - cornerRadius}
          Q ${srcX} ${midY}, ${srcX + sign * cornerRadius} ${midY}
          L ${tgtX - sign * cornerRadius} ${midY}
          Q ${tgtX} ${midY}, ${tgtX} ${midY + cornerRadius}
          L ${tgtX} ${tgtY}`;
}

/**
 * Generate a fault connector path (exits horizontally from right side)
 */
function createFaultPath(
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  cornerRadius: number = CORNER_RADIUS
): string {
  // Check if nearly horizontal
  if (Math.abs(tgtY - srcY) < 15) {
    return `M ${srcX} ${srcY} L ${tgtX} ${tgtY}`;
  }

  const horizontalEndX = srcX + FAULT_HORIZONTAL_OFFSET;

  if (tgtY > srcY) {
    // Target is below
    return `M ${srcX} ${srcY} 
            L ${horizontalEndX - cornerRadius} ${srcY}
            Q ${horizontalEndX} ${srcY}, ${horizontalEndX} ${srcY + cornerRadius}
            L ${horizontalEndX} ${tgtY - cornerRadius}
            Q ${horizontalEndX} ${tgtY}, ${horizontalEndX + cornerRadius} ${tgtY}
            L ${tgtX} ${tgtY}`;
  } else {
    // Target is above
    return `M ${srcX} ${srcY} 
            L ${horizontalEndX - cornerRadius} ${srcY}
            Q ${horizontalEndX} ${srcY}, ${horizontalEndX} ${srcY - cornerRadius}
            L ${horizontalEndX} ${tgtY + cornerRadius}
            Q ${horizontalEndX} ${tgtY}, ${horizontalEndX + cornerRadius} ${tgtY}
            L ${tgtX} ${tgtY}`;
  }
}

/**
 * Generate a loop-back connector path (goes left and up)
 */
function createLoopBackPath(
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number,
  cornerRadius: number = 15
): string {
  const offsetX = Math.min(50, Math.abs(srcX - tgtX) / 2 + 30);
  const leftX = Math.min(srcX, tgtX) - offsetX;

  return `M ${srcX} ${srcY} 
          L ${srcX} ${srcY + 20} 
          Q ${srcX} ${srcY + 20 + cornerRadius}, ${srcX - cornerRadius} ${srcY + 20 + cornerRadius}
          L ${leftX + cornerRadius} ${srcY + 20 + cornerRadius}
          Q ${leftX} ${srcY + 20 + cornerRadius}, ${leftX} ${srcY + 20}
          L ${leftX} ${tgtY + 20}
          Q ${leftX} ${tgtY - cornerRadius}, ${leftX + cornerRadius} ${tgtY - cornerRadius}
          L ${tgtX - cornerRadius} ${tgtY - cornerRadius}
          Q ${tgtX} ${tgtY - cornerRadius}, ${tgtX} ${tgtY}`;
}

// ============================================================================
// BRANCH LINE RENDERING
// Salesforce draws branch connectors with a horizontal "branch line"
// ============================================================================

interface BranchLineInfo {
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

function calculateBranchLines(
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

  // Find branching nodes (DECISION, WAIT, LOOP, or START with multiple paths)
  nodes.forEach((srcNode) => {
    const srcEdges = edgesBySource.get(srcNode.id) || [];
    const nonFaultEdges = srcEdges.filter(
      (e) =>
        e.type !== "fault" && e.type !== "fault-end" && e.type !== "loop-end"
    );

    // Check if this is a branching node
    const isBranchingNode =
      srcNode.type === "DECISION" ||
      srcNode.type === "WAIT" ||
      srcNode.type === "LOOP" ||
      (srcNode.type === "START" && nonFaultEdges.length > 1);

    if (!isBranchingNode) {
      return;
    }

    let branchEdges = nonFaultEdges;

    if (branchEdges.length < 2 && srcNode.type !== "LOOP") {
      return;
    }

    // Sort branches: rules/immediate on left, default/async on right (Salesforce style)
    branchEdges = [...branchEdges].sort((a, b) => {
      // For START nodes: "Run Immediately" on left, "Run Asynchronously" on right
      const aIsAsync =
        a.label?.toLowerCase().includes("asynchron") ||
        a.label?.toLowerCase().includes("scheduled") ||
        a.id?.includes("-sched");
      const bIsAsync =
        b.label?.toLowerCase().includes("asynchron") ||
        b.label?.toLowerCase().includes("scheduled") ||
        b.id?.includes("-sched");
      if (aIsAsync && !bIsAsync) return 1;
      if (!aIsAsync && bIsAsync) return -1;

      // For DECISION/WAIT: rules on left, default on right
      const aIsDefault =
        a.label?.toLowerCase().includes("default") ||
        a.label === "Other" ||
        a.id?.includes("-def");
      const bIsDefault =
        b.label?.toLowerCase().includes("default") ||
        b.label === "Other" ||
        b.id?.includes("-def");
      if (aIsDefault && !bIsDefault) return 1;
      if (!aIsDefault && bIsDefault) return -1;
      return 0;
    });

    const srcCenterX = srcNode.x + srcNode.width / 2;
    const srcBottomY = srcNode.y + srcNode.height;
    const branchLineY = srcBottomY + 35;

    // Calculate branch spread positions from the source node center
    const numBranches = branchEdges.length;
    const totalWidth = numBranches * COL_WIDTH;
    const startX = srcCenterX - totalWidth / 2 + COL_WIDTH / 2;

    const branches = branchEdges
      .map((edge, idx) => {
        const tgt = nodeMap.get(edge.target);
        if (!tgt) return null;

        return {
          edge,
          branchX: startX + idx * COL_WIDTH, // Spread position on branch line
          targetX: tgt.x + tgt.width / 2, // Actual target position
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

// ============================================================================
// MERGE LINE RENDERING
// ============================================================================

interface MergeLineInfo {
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

function calculateMergeLines(
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

  // Find merge nodes (multiple incoming non-fault edges)
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
        // This is a loop-back edge, exclude it
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

// ============================================================================
// MAIN EDGE RENDERER COMPONENT
// ============================================================================

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({ nodes, edges }) => {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // edgesBySource available for future edge grouping needs
  // const edgesBySource = useMemo(() => {
  //   const map = new Map<string, FlowEdge[]>();
  //   edges.forEach((edge) => {
  //     const list = map.get(edge.source) || [];
  //     list.push(edge);
  //     map.set(edge.source, list);
  //   });
  //   return map;
  // }, [edges]);

  // Calculate branch and merge lines
  const branchLines = useMemo(
    () => calculateBranchLines(nodes, edges),
    [nodes, edges]
  );

  const handledEdges = useMemo(() => {
    const set = new Set<string>();
    branchLines.forEach((bl) => {
      bl.branches.forEach((b) => set.add(b.edge.id));
    });
    return set;
  }, [branchLines]);

  const mergeLines = useMemo(
    () => calculateMergeLines(nodes, edges, handledEdges),
    [nodes, edges, handledEdges]
  );

  // Track all handled edges
  const allHandledEdges = useMemo(() => {
    const set = new Set(handledEdges);
    mergeLines.forEach((ml) => {
      ml.sources.forEach((s) => set.add(s.edge.id));
    });
    return set;
  }, [handledEdges, mergeLines]);

  // Render branch lines
  const renderBranchLines = () => {
    const elements: JSX.Element[] = [];

    branchLines.forEach((bl) => {
      const srcNode = nodeMap.get(bl.sourceId);
      if (!srcNode) return;

      const srcCenterX = srcNode.x + srcNode.width / 2;
      const srcBottomY = srcNode.y + srcNode.height;

      // Horizontal branch line
      elements.push(
        <path
          key={`branch-line-${bl.sourceId}`}
          d={`M ${bl.minX} ${bl.branchLineY} L ${bl.maxX} ${bl.branchLineY}`}
          fill="none"
          stroke={CONNECTOR_COLORS.default}
          strokeWidth={CONNECTOR_WIDTHS.default}
        />
      );

      // Vertical stem from source
      elements.push(
        <path
          key={`branch-stem-${bl.sourceId}`}
          d={`M ${srcCenterX} ${srcBottomY} L ${srcCenterX} ${bl.branchLineY}`}
          fill="none"
          stroke={CONNECTOR_COLORS.default}
          strokeWidth={CONNECTOR_WIDTHS.default}
        />
      );

      // Branch drops to targets
      bl.branches.forEach(({ edge, branchX, targetX, targetY }) => {
        const dx = targetX - branchX;

        let path: string;
        if (Math.abs(dx) < 5) {
          // Straight vertical drop
          path = `M ${branchX} ${bl.branchLineY} L ${targetX} ${targetY}`;
        } else {
          // Orthogonal routing with corners
          path = createOrthogonalPath(
            branchX,
            bl.branchLineY,
            targetX,
            targetY
          );
        }

        elements.push(
          <g key={`branch-drop-${edge.id}`}>
            <path
              d={path}
              fill="none"
              stroke={CONNECTOR_COLORS.default}
              strokeWidth={CONNECTOR_WIDTHS.default}
              markerEnd="url(#arrow)"
            />
            {edge.label && (
              <EdgeLabel
                x={branchX}
                y={bl.branchLineY - 10}
                label={edge.label}
              />
            )}
          </g>
        );
      });
    });

    return elements;
  };

  // Render merge lines
  const renderMergeLines = () => {
    const elements: JSX.Element[] = [];

    mergeLines.forEach((ml) => {
      // Horizontal merge line
      elements.push(
        <path
          key={`merge-line-${ml.targetId}`}
          d={`M ${ml.minX} ${ml.mergeLineY} L ${ml.maxX} ${ml.mergeLineY}`}
          fill="none"
          stroke={CONNECTOR_COLORS.default}
          strokeWidth={CONNECTOR_WIDTHS.default}
        />
      );

      // Vertical drop to target
      elements.push(
        <path
          key={`merge-stem-${ml.targetId}`}
          d={`M ${ml.centerX} ${ml.mergeLineY} L ${ml.centerX} ${ml.targetY}`}
          fill="none"
          stroke={CONNECTOR_COLORS.default}
          strokeWidth={CONNECTOR_WIDTHS.default}
          markerEnd="url(#arrow)"
        />
      );

      // Source connections to merge line
      ml.sources.forEach(({ edge, x, y }) => {
        const dx = ml.centerX - x;

        let path: string;
        if (Math.abs(dx) < 5) {
          path = `M ${x} ${y} L ${x} ${ml.mergeLineY}`;
        } else {
          const sign = dx > 0 ? 1 : -1;
          path = `M ${x} ${y}
                  L ${x} ${ml.mergeLineY - CORNER_RADIUS}
                  Q ${x} ${ml.mergeLineY}, ${x + sign * CORNER_RADIUS} ${ml.mergeLineY}`;
        }

        elements.push(
          <path
            key={`merge-drop-${edge.id}`}
            d={path}
            fill="none"
            stroke={CONNECTOR_COLORS.default}
            strokeWidth={CONNECTOR_WIDTHS.default}
          />
        );
      });
    });

    return elements;
  };

  // Render remaining edges
  const renderRemainingEdges = () => {
    const elements: JSX.Element[] = [];

    edges.forEach((edge) => {
      if (allHandledEdges.has(edge.id)) return;

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

      let path: string;
      const showAsRed = isFault || isFaultEnd;
      const showAsBlue = isGoTo && !showAsRed;

      if (isFaultEnd) {
        // Straight horizontal line for fault-end
        path = `M ${srcRightX} ${srcCenterY} L ${tgtLeftX} ${srcCenterY}`;
      } else if (isFault) {
        // Fault path routing
        path = createFaultPath(srcRightX, srcCenterY, tgtLeftX, tgtCenterY);
      } else if (isLoopBack) {
        // Loop-back connector
        path = createLoopBackPath(srcCenterX, srcBottomY, tgtCenterX, tgtTopY);
      } else if (Math.abs(tgtCenterX - srcCenterX) < 5) {
        // Straight vertical line
        path = `M ${srcCenterX} ${srcBottomY} L ${tgtCenterX} ${tgtTopY}`;
      } else {
        // Orthogonal routing
        path = createOrthogonalPath(
          srcCenterX,
          srcBottomY,
          tgtCenterX,
          tgtTopY
        );
      }

      // Calculate label position
      let labelX = (srcCenterX + tgtCenterX) / 2;
      let labelY = srcBottomY + 20;

      if (isFault || isFaultEnd) {
        labelX = (srcRightX + tgtLeftX) / 2;
        labelY = srcCenterY - 12;
      } else if (isLoopBack) {
        const offsetX = Math.min(
          50,
          Math.abs(srcCenterX - tgtCenterX) / 2 + 30
        );
        labelX = Math.min(srcCenterX, tgtCenterX) - offsetX;
        labelY = (srcBottomY + tgtTopY) / 2;
      }

      // Determine stroke color and marker based on edge type
      let strokeColor = CONNECTOR_COLORS.default;
      let markerEnd = "url(#arrow)";
      let strokeDasharray: string | undefined = undefined;

      if (showAsRed) {
        strokeColor = CONNECTOR_COLORS.fault;
        markerEnd = "url(#arrow-red)";
        strokeDasharray = "6,4";
      } else if (showAsBlue) {
        strokeColor = CONNECTOR_COLORS.goto;
        markerEnd = "url(#arrow-blue)";
        strokeDasharray = "6,4"; // GoTo connectors are dashed like fault but blue
      }

      elements.push(
        <g key={edge.id}>
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={CONNECTOR_WIDTHS.default}
            strokeDasharray={strokeDasharray}
            markerEnd={markerEnd}
          />
          {edge.label && (
            <EdgeLabel
              x={labelX}
              y={labelY}
              label={edge.label}
              isFault={showAsRed}
            />
          )}
        </g>
      );
    });

    return elements;
  };

  return (
    <svg className="absolute top-0 left-0 w-1 h-1 overflow-visible pointer-events-none">
      <EdgeMarkers />
      {renderBranchLines()}
      {renderMergeLines()}
      {renderRemainingEdges()}
    </svg>
  );
};

export default EdgeRenderer;
