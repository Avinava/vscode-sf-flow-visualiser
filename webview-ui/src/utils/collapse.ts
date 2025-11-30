/**
 * Collapse Utilities
 *
 * Functions to compute which nodes and edges should be hidden
 * when branching nodes are collapsed.
 */

import type { FlowNode, FlowEdge } from "../types";

/**
 * Find the merge point for a branching node
 * Returns the node ID where all branches converge, or null if branches terminate
 */
export function findMergePoint(
  branchingNodeId: string,
  edges: FlowEdge[],
  _nodeMap?: Map<string, FlowNode>
): string | null {
  // Get all outgoing edges from the branching node (excluding faults)
  const branchEdges = edges.filter(
    (e) =>
      e.source === branchingNodeId &&
      e.type !== "fault" &&
      e.type !== "fault-end"
  );

  if (branchEdges.length <= 1) return null;

  // BFS to find common reachable node from all branches
  const branchTargets = branchEdges.map((e) => e.target);

  // Build reachable sets for each branch
  const reachableSets: Set<string>[] = branchTargets.map((target) => {
    const reachable = new Set<string>();
    const queue = [target];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      reachable.add(current);

      // Get outgoing edges
      const outEdges = edges.filter(
        (e) =>
          e.source === current &&
          e.type !== "fault" &&
          e.type !== "fault-end" &&
          !e.isGoTo
      );
      for (const edge of outEdges) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }
    return reachable;
  });

  // Find intersection of all reachable sets
  if (reachableSets.length === 0) return null;

  const commonReachable = [...reachableSets[0]].filter((nodeId) =>
    reachableSets.every((set) => set.has(nodeId))
  );

  if (commonReachable.length === 0) return null;

  // Find the closest common node (lowest depth from branching node)
  let closestMerge: string | null = null;
  let minDepth = Infinity;

  for (const candidate of commonReachable) {
    // Calculate minimum depth to this candidate from any branch
    let minBranchDepth = Infinity;
    for (const target of branchTargets) {
      const depth = calculateDepth(target, candidate, edges, new Set());
      if (depth !== null && depth < minBranchDepth) {
        minBranchDepth = depth;
      }
    }
    if (minBranchDepth < minDepth) {
      minDepth = minBranchDepth;
      closestMerge = candidate;
    }
  }

  return closestMerge;
}

/**
 * Calculate depth from start to target
 */
function calculateDepth(
  start: string,
  target: string,
  edges: FlowEdge[],
  visited: Set<string>
): number | null {
  if (start === target) return 0;
  if (visited.has(start)) return null;

  visited.add(start);

  const outEdges = edges.filter(
    (e) => e.source === start && e.type !== "fault" && e.type !== "fault-end"
  );

  for (const edge of outEdges) {
    const subDepth = calculateDepth(edge.target, target, edges, visited);
    if (subDepth !== null) {
      return subDepth + 1;
    }
  }

  return null;
}

/**
 * Get all nodes that are hidden when a branching node is collapsed
 *
 * Strategy: Only hide nodes that are EXCLUSIVELY reachable from this branching node's
 * non-default branches. If a node can be reached via another path (like from parent's
 * default connector), it should NOT be hidden.
 */
export function getHiddenNodesForCollapse(
  branchingNodeId: string,
  edges: FlowEdge[],
  _nodeMap: Map<string, FlowNode>,
  allEdges?: FlowEdge[]
): Set<string> {
  const hidden = new Set<string>();
  const edgesToUse = allEdges || edges;

  // Get all branch edges from this node (excluding faults)
  const branchEdges = edges.filter(
    (e) =>
      e.source === branchingNodeId &&
      e.type !== "fault" &&
      e.type !== "fault-end"
  );

  if (branchEdges.length <= 1) return hidden;

  // Find the merge point
  const mergePoint = findMergePoint(branchingNodeId, edges);

  // Collect all nodes reachable from each branch (before merge point)
  const branchNodes = new Map<string, Set<string>>();

  for (const edge of branchEdges) {
    // Skip branches that go directly to merge point
    if (mergePoint && edge.target === mergePoint) {
      continue;
    }

    const nodesInBranch = new Set<string>();
    collectNodesUntilMerge(
      edge.target,
      mergePoint,
      edges,
      nodesInBranch,
      new Set()
    );
    branchNodes.set(edge.id, nodesInBranch);
  }

  // Build a set of all nodes reachable from ANY source EXCEPT through this branching node
  const reachableFromElsewhere = new Set<string>();

  // For each node in our branches, check if it's reachable from elsewhere
  const allBranchNodes = new Set<string>();
  branchNodes.forEach((nodes) => nodes.forEach((n) => allBranchNodes.add(n)));

  for (const nodeId of allBranchNodes) {
    // Check if this node has incoming edges from outside our branches
    const incomingEdges = edgesToUse.filter(
      (e) =>
        e.target === nodeId &&
        e.source !== branchingNodeId &&
        e.type !== "fault" &&
        e.type !== "fault-end"
    );

    for (const incoming of incomingEdges) {
      // If the source of this incoming edge is NOT in our branch nodes,
      // then this node is reachable from elsewhere
      if (!allBranchNodes.has(incoming.source)) {
        reachableFromElsewhere.add(nodeId);
        break;
      }
    }
  }

  // Only hide nodes that are NOT reachable from elsewhere
  for (const nodeId of allBranchNodes) {
    if (!reachableFromElsewhere.has(nodeId)) {
      hidden.add(nodeId);
    }
  }

  // Don't hide the merge point itself
  if (mergePoint) {
    hidden.delete(mergePoint);
  }

  return hidden;
}

/**
 * Recursively collect nodes from start until merge point
 */
function collectNodesUntilMerge(
  nodeId: string,
  mergePoint: string | null,
  edges: FlowEdge[],
  hidden: Set<string>,
  visited: Set<string>
): void {
  if (!nodeId || visited.has(nodeId)) return;
  if (mergePoint && nodeId === mergePoint) return;

  visited.add(nodeId);
  hidden.add(nodeId);

  const outEdges = edges.filter(
    (e) => e.source === nodeId && e.type !== "fault" && e.type !== "fault-end"
  );

  for (const edge of outEdges) {
    collectNodesUntilMerge(edge.target, mergePoint, edges, hidden, visited);
  }
}

/**
 * Get all edges that should be hidden when certain nodes are hidden
 */
export function getHiddenEdges(
  hiddenNodes: Set<string>,
  edges: FlowEdge[]
): Set<string> {
  const hiddenEdges = new Set<string>();

  for (const edge of edges) {
    // Hide edge if source or target is hidden
    if (hiddenNodes.has(edge.source) || hiddenNodes.has(edge.target)) {
      hiddenEdges.add(edge.id);
    }
  }

  return hiddenEdges;
}

/**
 * Compute all hidden nodes and edges given a set of collapsed branching nodes
 */
export function computeVisibility(
  collapsedNodeIds: Set<string>,
  nodes: FlowNode[],
  edges: FlowEdge[]
): { hiddenNodes: Set<string>; hiddenEdges: Set<string> } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const allHiddenNodes = new Set<string>();

  for (const collapsedId of collapsedNodeIds) {
    const hiddenForNode = getHiddenNodesForCollapse(
      collapsedId,
      edges,
      nodeMap
    );
    hiddenForNode.forEach((id) => allHiddenNodes.add(id));
  }

  const hiddenEdges = getHiddenEdges(allHiddenNodes, edges);

  // Also hide edges that come from collapsed nodes to their branches
  // (but keep the edge to merge point)
  for (const collapsedId of collapsedNodeIds) {
    const branchEdges = edges.filter(
      (e) =>
        e.source === collapsedId && e.type !== "fault" && e.type !== "fault-end"
    );
    const mergePoint = findMergePoint(collapsedId, edges, nodeMap);

    for (const edge of branchEdges) {
      // Hide all branch edges except the one to merge point (if any)
      if (mergePoint && edge.target === mergePoint) continue;
      hiddenEdges.add(edge.id);
    }
  }

  return { hiddenNodes: allHiddenNodes, hiddenEdges };
}

/**
 * Get the list of branching node IDs from a flow
 */
export function getBranchingNodeIds(nodes: FlowNode[]): string[] {
  return nodes
    .filter(
      (n) => n.type === "DECISION" || n.type === "WAIT" || n.type === "LOOP"
    )
    .map((n) => n.id);
}
