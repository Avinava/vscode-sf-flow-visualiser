/**
 * Branch Calculator
 *
 * Calculates branch depths and subtree widths for layout positioning.
 * These calculations are essential for proper branch spread and merge point alignment.
 *
 * Based on Salesforce's branch calculation logic in alcConversionUtils.js
 */

import type { FlowNode, FlowEdge } from "../types";
import { findMergePointForBranches } from "./mergePointFinder";

/**
 * Calculate the depth (height in rows) of a branch until merge point or termination
 *
 * @param startId - Starting node ID
 * @param nodeMap - Node lookup map
 * @param outgoing - Outgoing edges map
 * @param stopAt - Optional node ID to stop at (merge point)
 * @param visited - Set of visited node IDs
 * @returns Depth of the branch in number of rows
 */
export function calculateBranchDepth(
  startId: string,
  nodeMap: Map<string, FlowNode>,
  outgoing: Map<string, FlowEdge[]>,
  stopAt?: string,
  visited = new Set<string>()
): number {
  if (!startId || visited.has(startId)) return 0;
  if (stopAt && startId === stopAt) return 0;

  const node = nodeMap.get(startId);
  if (!node) return 0;

  visited.add(startId);

  const outs = (outgoing.get(startId) || []).filter(
    (e) => e.type !== "fault" && e.type !== "fault-end"
  );

  if (outs.length === 0) return 1; // Terminal node

  const nodeType = node.type;

  // For branching nodes (including START with multiple paths), include all their branches' depth
  const isBranchingStart = nodeType === "START" && outs.length > 1;
  if (nodeType === "DECISION" || nodeType === "WAIT" || isBranchingStart) {
    const branchTargets = outs.map((e) => e.target);
    const merge = findMergePointForBranches(branchTargets, outgoing, nodeMap);

    let maxBranchDepth = 0;
    outs.forEach((e) => {
      const depth = calculateBranchDepth(
        e.target,
        nodeMap,
        outgoing,
        merge,
        new Set(visited)
      );
      maxBranchDepth = Math.max(maxBranchDepth, depth);
    });

    // After branches, continue from merge point
    const afterMerge = merge
      ? calculateBranchDepth(merge, nodeMap, outgoing, stopAt, new Set(visited))
      : 0;
    return 1 + maxBranchDepth + afterMerge;
  }

  if (nodeType === "LOOP") {
    const forEachEdge = outs.find((e) => e.type === "loop-next");
    const afterLastEdge = outs.find((e) => e.type === "loop-end");

    const loopBodyDepth = forEachEdge
      ? calculateBranchDepth(
          forEachEdge.target,
          nodeMap,
          outgoing,
          startId, // Loop body ends at loop node
          new Set(visited)
        )
      : 0;
    const afterLoopDepth = afterLastEdge
      ? calculateBranchDepth(
          afterLastEdge.target,
          nodeMap,
          outgoing,
          stopAt,
          new Set(visited)
        )
      : 0;

    return 1 + Math.max(loopBodyDepth, 1) + afterLoopDepth;
  }

  // Linear node - continue down
  return (
    1 + calculateBranchDepth(outs[0].target, nodeMap, outgoing, stopAt, visited)
  );
}

/**
 * Calculate the width of a subtree (for horizontal positioning)
 *
 * @param startId - Starting node ID
 * @param nodeMap - Node lookup map
 * @param outgoing - Outgoing edges map
 * @param stopAt - Optional node ID to stop at (merge point)
 * @param visited - Set of visited node IDs
 * @returns Width of the subtree in number of columns
 */
export function calculateSubtreeWidth(
  startId: string,
  nodeMap: Map<string, FlowNode>,
  outgoing: Map<string, FlowEdge[]>,
  stopAt?: string,
  visited = new Set<string>()
): number {
  if (!startId || visited.has(startId)) return 1;
  if (stopAt && startId === stopAt) return 0;

  const node = nodeMap.get(startId);
  if (!node) return 1;

  visited.add(startId);

  const outs = (outgoing.get(startId) || []).filter(
    (e) => e.type !== "fault" && e.type !== "fault-end"
  );

  if (outs.length === 0) return 1;

  const nodeType = node.type;

  // Handle branching nodes (including START with multiple paths)
  const isBranchingStart = nodeType === "START" && outs.length > 1;
  if (nodeType === "DECISION" || nodeType === "WAIT" || isBranchingStart) {
    const branchTargets = outs.map((e) => e.target);
    const merge = findMergePointForBranches(branchTargets, outgoing, nodeMap);

    // Total width is sum of all branch widths
    let totalWidth = 0;
    outs.forEach((e) => {
      const branchWidth = calculateSubtreeWidth(
        e.target,
        nodeMap,
        outgoing,
        merge,
        new Set(visited)
      );
      totalWidth += Math.max(branchWidth, 1);
    });

    // Width after merge
    const afterMergeWidth = merge
      ? calculateSubtreeWidth(
          merge,
          nodeMap,
          outgoing,
          stopAt,
          new Set(visited)
        )
      : 0;

    return Math.max(totalWidth, afterMergeWidth, 1);
  }

  if (nodeType === "LOOP") {
    const forEachEdge = outs.find((e) => e.type === "loop-next");
    const afterLastEdge = outs.find((e) => e.type === "loop-end");

    const loopBodyWidth = forEachEdge
      ? calculateSubtreeWidth(
          forEachEdge.target,
          nodeMap,
          outgoing,
          startId,
          new Set(visited)
        )
      : 1;
    const afterLoopWidth = afterLastEdge
      ? calculateSubtreeWidth(
          afterLastEdge.target,
          nodeMap,
          outgoing,
          stopAt,
          new Set(visited)
        )
      : 1;

    // Loop needs at least 2 columns: loop body + main path
    return Math.max(loopBodyWidth + 1, afterLoopWidth, 2);
  }

  // Linear node
  return calculateSubtreeWidth(
    outs[0].target,
    nodeMap,
    outgoing,
    stopAt,
    visited
  );
}

/**
 * Calculate widths for all branches from a branching node
 *
 * @param branchEdges - Branch edges from the branching node
 * @param nodeMap - Node lookup map
 * @param outgoing - Outgoing edges map
 * @param mergePoint - The merge point for these branches
 * @param visited - Set of visited node IDs
 * @returns Array of widths for each branch
 */
export function calculateBranchWidths(
  branchEdges: FlowEdge[],
  nodeMap: Map<string, FlowNode>,
  outgoing: Map<string, FlowEdge[]>,
  mergePoint?: string,
  visited = new Set<string>()
): number[] {
  return branchEdges.map((e) => {
    const width = calculateSubtreeWidth(
      e.target,
      nodeMap,
      outgoing,
      mergePoint,
      new Set(visited)
    );
    return Math.max(width, 1);
  });
}

/**
 * Calculate the total width needed for all branches
 *
 * @param branchWidths - Array of individual branch widths
 * @returns Total width needed
 */
export function calculateTotalBranchWidth(branchWidths: number[]): number {
  return branchWidths.reduce((a, b) => a + b, 0);
}
