/**
 * Merge Point Finder
 *
 * Detects merge points where multiple branches converge to a single node.
 * Uses BFS traversal to find the closest common reachable node.
 *
 * Based on Salesforce's findMergePointForBranches logic in alcConversionUtils.js
 */

import type { FlowNode, FlowEdge } from "../types";

/**
 * Find the merge point for branches from a branching node
 * This is where multiple branches converge to a single node
 *
 * @param branchTargets - Array of target node IDs from branch edges
 * @param outgoing - Map of outgoing edges per node
 * @param _nodeMap - Node lookup map (reserved for future use)
 * @returns The ID of the merge point node, or undefined if none found
 */
export function findMergePointForBranches(
  branchTargets: string[],
  outgoing: Map<string, FlowEdge[]>,
  _nodeMap: Map<string, FlowNode>
): string | undefined {
  if (branchTargets.length < 2) return undefined;

  // BFS from each branch to find common reachable nodes
  const reachable = branchTargets.map((target) => {
    const reached = new Map<string, number>(); // nodeId -> depth
    const queue: { id: string; depth: number }[] = [{ id: target, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      reached.set(id, depth);

      // Filter out fault paths - they don't participate in merge
      const outs = (outgoing.get(id) || []).filter(
        (e) => e.type !== "fault" && e.type !== "fault-end"
      );
      outs.forEach((e) => queue.push({ id: e.target, depth: depth + 1 }));
    }
    return reached;
  });

  // Find closest common node (lowest total depth)
  let bestMerge: string | undefined;
  let bestTotalDepth = Infinity;

  const firstReach = reachable[0];
  for (const [nodeId, depth0] of firstReach) {
    let isCommon = true;
    let totalDepth = depth0;

    for (let i = 1; i < reachable.length; i++) {
      const depthI = reachable[i].get(nodeId);
      if (depthI === undefined) {
        isCommon = false;
        break;
      }
      totalDepth += depthI;
    }

    if (isCommon && totalDepth < bestTotalDepth) {
      bestTotalDepth = totalDepth;
      bestMerge = nodeId;
    }
  }

  return bestMerge;
}

/**
 * Find all merge points in a flow
 *
 * @param nodes - All flow nodes
 * @param edges - All flow edges
 * @returns Map of branching node ID to merge point ID
 */
export function findAllMergePoints(
  nodes: FlowNode[],
  edges: FlowEdge[]
): Map<string, string> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, FlowEdge[]>();

  edges.forEach((e) => {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  });

  const mergePoints = new Map<string, string>();

  // Find merge points for each branching node
  nodes.forEach((node) => {
    if (
      node.type === "DECISION" ||
      node.type === "WAIT" ||
      (node.type === "START" && (outgoing.get(node.id) || []).length > 1)
    ) {
      const branchEdges = (outgoing.get(node.id) || []).filter(
        (e) => e.type !== "fault" && e.type !== "fault-end"
      );

      if (branchEdges.length > 1) {
        const branchTargets = branchEdges.map((e) => e.target);
        const mergePoint = findMergePointForBranches(
          branchTargets,
          outgoing,
          nodeMap
        );

        if (mergePoint) {
          mergePoints.set(node.id, mergePoint);
        }
      }
    }
  });

  return mergePoints;
}
