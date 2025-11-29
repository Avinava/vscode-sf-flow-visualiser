/**
 * Auto-Layout Engine for Salesforce Flow Visualizer
 *
 * This module implements a tree-based auto-layout algorithm inspired by
 * Salesforce's Auto-Layout Canvas (ALC) system. Key features:
 *
 * 1. Build a tree structure with branches from decision/wait/loop nodes
 * 2. Calculate width of each subtree recursively
 * 3. Position branches symmetrically around parent's X position
 * 4. Track merge points where branches converge
 * 5. Use consistent spacing with clear visual hierarchy
 *
 * References:
 * - alcCanvasUtils.js: Node type detection, child count calculation
 * - alcCanvas.js: Layout orchestration, panzoom, rendering
 * - alcConversionUtils.js: Graph traversal, merge point detection
 * - alcFlow.js: Flow rendering, nested flows
 * - alcComponentsUtils.js: Component utilities, styling
 */

import type { FlowNode, FlowEdge, LayoutConfig, Geometry } from "../types";

// ============================================================================
// DEFAULT LAYOUT CONFIGURATION
// Based on Salesforce's getDefaultLayoutConfig()
// ============================================================================

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  node: {
    icon: {
      w: 48,
      h: 48,
    },
    width: 220,
    height: 56,
  },
  connector: {
    icon: {
      w: 20,
    },
  },
  grid: {
    hGap: 80, // Horizontal gap between adjacent nodes
    vGap: 80, // Vertical gap between rows
  },
  start: {
    x: 800, // Canvas center X
    y: 80, // Canvas top Y
  },
};

// Card layout config (for element cards mode)
export const CARD_LAYOUT_CONFIG: LayoutConfig = {
  ...DEFAULT_LAYOUT_CONFIG,
  node: {
    ...DEFAULT_LAYOUT_CONFIG.node,
    width: 285,
  },
};

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

// Fault path special index (from alcCanvasUtils)
export const FAULT_INDEX = -1;

// For Each index in loops
export const FOR_EACH_INDEX = 0;

// Start immediate index for scheduled paths
export const START_IMMEDIATE_INDEX = 0;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a map from node ID to node for quick lookups
 */
function createNodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Create a map of outgoing edges for each node
 */
function createOutgoingMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const outgoing = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  });
  return outgoing;
}

/**
 * Create a map of incoming edges for each node
 */
function createIncomingMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const incoming = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e);
  });
  return incoming;
}

/**
 * Check if a node is a branching node (has multiple outgoing paths)
 * Based on Salesforce's isBranchingElement and supportsBranching
 */
function _isBranchingNode(node: FlowNode): boolean {
  switch (node.type) {
    case "DECISION":
    case "WAIT":
      return true;
    case "LOOP":
      return true; // Loops have FOR_EACH and AFTER_LAST branches
    case "START":
      // START can have scheduled paths
      return (node.children && node.children.length > 0) || false;
    default:
      return false;
  }
}

/**
 * Check if a node supports children (branching or loop)
 * Based on Salesforce's supportsChildren in alcCanvasUtils
 */
function _supportsChildren(node: FlowNode): boolean {
  return (
    node.type === "DECISION" ||
    node.type === "WAIT" ||
    node.type === "LOOP" ||
    node.type === "START"
  );
}

/**
 * Get the number of children/branches a node can have
 * Based on Salesforce's getChildCount in alcCanvasUtils
 */
function _getChildCount(node: FlowNode): number | null {
  if (node.type === "LOOP") return 1; // Loop has single FOR_EACH child

  if (
    node.type === "DECISION" ||
    node.type === "WAIT" ||
    node.type === "START"
  ) {
    const childRefs = node.children || [];
    // Account for default connector
    return childRefs.length + 1;
  }

  return null;
}

// ============================================================================
// MERGE POINT DETECTION
// Based on Salesforce's findMergePointForBranches logic in alcConversionUtils
// ============================================================================

/**
 * Find the merge point for branches from a branching node
 * This is where multiple branches converge to a single node
 */
function findMergePointForBranches(
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

// ============================================================================
// BRANCH DEPTH CALCULATION
// Calculates the depth (height in rows) of a branch until merge point or termination
// ============================================================================

function calculateBranchDepth(
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

  // For branching nodes, include all their branches' depth
  if (nodeType === "DECISION" || nodeType === "WAIT") {
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

// ============================================================================
// SUBTREE WIDTH CALCULATION
// Calculates the width of a subtree (for horizontal positioning)
// ============================================================================

function calculateSubtreeWidth(
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

  if (nodeType === "DECISION" || nodeType === "WAIT") {
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

// ============================================================================
// MAIN AUTO-LAYOUT FUNCTION
// Based on Salesforce's calculateFlowLayout and renderFlow
// ============================================================================

export interface AutoLayoutOptions {
  config?: LayoutConfig;
  startNodeId?: string;
}

/**
 * Auto-layout flow nodes using a tree-based algorithm
 *
 * This implements Salesforce's auto-layout canvas pattern:
 * 1. Builds position maps for nodes
 * 2. Handles branching (Decision, Wait) and looping (Loop) nodes
 * 3. Calculates merge points for branch convergence
 * 4. Positions fault paths to the right
 */
export function autoLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: AutoLayoutOptions = {}
): FlowNode[] {
  if (nodes.length === 0) return nodes;

  const config = options.config || DEFAULT_LAYOUT_CONFIG;
  const startNodeId = options.startNodeId || "START_NODE";

  const nodeMap = createNodeMap(nodes);
  const outgoing = createOutgoingMap(edges);
  // incoming map available for future use (e.g., detecting merge points)
  // const incoming = createIncomingMap(edges);

  // Layout dimensions
  const ROW_HEIGHT = config.node.height + config.grid.vGap;
  const COL_WIDTH = config.node.width + config.grid.hGap;
  const START_X = config.start.x;
  const START_Y = config.start.y;

  // Position storage
  const positions = new Map<string, { x: number; y: number }>();

  /**
   * Recursively layout nodes starting from nodeId
   */
  function layoutNode(
    nodeId: string,
    centerX: number,
    row: number,
    stopAt?: string,
    visited = new Set<string>()
  ): void {
    if (!nodeId || visited.has(nodeId)) return;
    if (stopAt && nodeId === stopAt) return;

    const node = nodeMap.get(nodeId);
    if (!node) return;

    visited.add(nodeId);

    // Position this node
    const y = START_Y + row * ROW_HEIGHT;
    positions.set(nodeId, { x: centerX, y });

    const outs = (outgoing.get(nodeId) || []).filter(
      (e) => e.type !== "fault" && e.type !== "fault-end"
    );
    const faultOuts = (outgoing.get(nodeId) || []).filter(
      (e) => e.type === "fault" || e.type === "fault-end"
    );

    // Handle fault paths - position to the right at the SAME vertical level
    faultOuts.forEach((edge, faultIndex) => {
      if (!visited.has(edge.target)) {
        const targetNode = nodeMap.get(edge.target);
        const isFaultEnd =
          edge.type === "fault-end" || targetNode?.type === "END";

        if (isFaultEnd) {
          // For fault-end: position END node at same Y level for straight horizontal line
          const srcY = START_Y + row * ROW_HEIGHT;
          const srcCenterY = srcY + (node?.height || config.node.height) / 2;
          const endNodeHeight = 40;
          const endNodeY = srcCenterY - endNodeHeight / 2;

          positions.set(edge.target, {
            x: centerX + COL_WIDTH * 1.5,
            y: endNodeY,
          });
          visited.add(edge.target);
        } else {
          // Regular fault path
          layoutNode(
            edge.target,
            centerX + COL_WIDTH * 1.5,
            row + faultIndex,
            undefined,
            new Set(visited)
          );
        }
      }
    });

    if (outs.length === 0) return;

    const nodeType = node.type;

    // Handle branching nodes (Decision, Wait)
    if (nodeType === "DECISION" || nodeType === "WAIT") {
      const branchTargets = outs.map((e) => e.target);
      const mergePoint = findMergePointForBranches(
        branchTargets,
        outgoing,
        nodeMap
      );

      // Sort branches: rules/named on left, default on right (Salesforce style)
      const sortedOuts = [...outs].sort((a, b) => {
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

      // Calculate widths of each branch
      const branchWidths = sortedOuts.map((e) => {
        const width = calculateSubtreeWidth(
          e.target,
          nodeMap,
          outgoing,
          mergePoint,
          new Set(visited)
        );
        return Math.max(width, 1);
      });
      const totalWidth = branchWidths.reduce((a, b) => a + b, 0);

      // Position branches spread outward from parent's center
      let currentX = centerX - (totalWidth * COL_WIDTH) / 2 + COL_WIDTH / 2;
      let maxBranchDepth = 0;
      let firstBranchCenterX = centerX;
      let lastBranchCenterX = centerX;

      sortedOuts.forEach((edge, idx) => {
        const branchWidth = branchWidths[idx];
        const branchCenterX = currentX + ((branchWidth - 1) * COL_WIDTH) / 2;

        if (idx === 0) firstBranchCenterX = branchCenterX;
        lastBranchCenterX = branchCenterX;

        const goesDirectlyToMerge = edge.target === mergePoint;

        if (!goesDirectlyToMerge && !visited.has(edge.target)) {
          layoutNode(
            edge.target,
            branchCenterX,
            row + 1,
            mergePoint,
            new Set(visited)
          );
        }

        const branchDepth = calculateBranchDepth(
          edge.target,
          nodeMap,
          outgoing,
          mergePoint,
          new Set(visited)
        );
        maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

        currentX += branchWidth * COL_WIDTH;
      });

      // Position merge point centered between all branches
      if (mergePoint && !visited.has(mergePoint)) {
        const mergeCenterX = (firstBranchCenterX + lastBranchCenterX) / 2;
        layoutNode(
          mergePoint,
          mergeCenterX,
          row + 1 + maxBranchDepth,
          stopAt,
          visited
        );
      }
    } else if (nodeType === "LOOP") {
      // Handle loop nodes
      const forEachEdge = outs.find((e) => e.type === "loop-next");
      const afterLastEdge = outs.find((e) => e.type === "loop-end");

      const loopBodyWidth = forEachEdge
        ? calculateSubtreeWidth(
            forEachEdge.target,
            nodeMap,
            outgoing,
            nodeId,
            new Set(visited)
          )
        : 1;

      // Position "For Each" branch to the left
      if (forEachEdge && !visited.has(forEachEdge.target)) {
        const loopBodyX = centerX - COL_WIDTH * (loopBodyWidth / 2 + 0.5);
        layoutNode(
          forEachEdge.target,
          loopBodyX,
          row + 1,
          nodeId,
          new Set(visited)
        );
      }

      // Calculate loop body depth for "After Last" positioning
      const loopBodyDepth = forEachEdge
        ? calculateBranchDepth(
            forEachEdge.target,
            nodeMap,
            outgoing,
            nodeId,
            new Set(visited)
          )
        : 1;

      // Position "After Last" below the loop
      if (afterLastEdge && !visited.has(afterLastEdge.target)) {
        layoutNode(
          afterLastEdge.target,
          centerX,
          row + 1 + loopBodyDepth,
          stopAt,
          visited
        );
      }
    } else {
      // Linear node - continue down
      outs.forEach((edge) => {
        if (!visited.has(edge.target)) {
          layoutNode(edge.target, centerX, row + 1, stopAt, visited);
        }
      });
    }
  }

  // Start layout from START_NODE
  layoutNode(startNodeId, START_X, 0);

  // Handle any unvisited nodes (orphaned)
  let maxRow = 0;
  positions.forEach((p) => {
    maxRow = Math.max(maxRow, Math.floor((p.y - START_Y) / ROW_HEIGHT));
  });

  nodes.forEach((n) => {
    if (!positions.has(n.id)) {
      maxRow++;
      positions.set(n.id, {
        x: START_X + 400,
        y: START_Y + maxRow * ROW_HEIGHT,
      });
    }
  });

  // Apply positions to nodes (center horizontally)
  return nodes.map((n) => {
    const pos = positions.get(n.id) || { x: START_X, y: START_Y };
    return { ...n, x: pos.x - n.width / 2, y: pos.y };
  });
}

// ============================================================================
// LAYOUT UTILITIES
// Based on Salesforce's alcComponentsUtils
// ============================================================================

/**
 * Get CSS style string from geometry
 */
export function getStyleFromGeometry(geometry: Partial<Geometry>): string {
  const parts: string[] = [];
  if (geometry.x !== undefined) parts.push(`left: ${geometry.x}px`);
  if (geometry.y !== undefined) parts.push(`top: ${geometry.y}px`);
  if (geometry.w !== undefined) parts.push(`width: ${geometry.w}px`);
  if (geometry.h !== undefined) parts.push(`height: ${geometry.h}px`);
  return parts.join("; ");
}

/**
 * Check if node has GoTo on next connection
 * Based on Salesforce's hasGoToOnNext
 */
export function hasGoToOnNext(node: FlowNode, edges: FlowEdge[]): boolean {
  if (!node.next) return false;
  const nextEdge = edges.find(
    (e) => e.source === node.id && e.target === node.next && e.type !== "fault"
  );
  return nextEdge?.isGoTo === true;
}

/**
 * Check if node has GoTo on branch head
 * Based on Salesforce's hasGoToOnBranchHead
 */
export function hasGoToOnBranchHead(
  nodeId: string,
  childIndex: number,
  nodeMap: Map<string, FlowNode>,
  edges: FlowEdge[]
): boolean {
  const node = nodeMap.get(nodeId);
  if (!node || !node.children) return false;

  const childId = node.children[childIndex];
  if (!childId) return false;

  const branchEdge = edges.find(
    (e) => e.source === nodeId && e.target === childId
  );
  return branchEdge?.isGoTo === true;
}

/**
 * Find the first element in a branch
 * Based on Salesforce's findFirstElement
 */
export function findFirstElement(
  nodeId: string,
  nodeMap: Map<string, FlowNode>
): FlowNode | undefined {
  let current = nodeMap.get(nodeId);
  while (current?.prev) {
    current = nodeMap.get(current.prev);
  }
  return current;
}

/**
 * Find the last element in a branch
 * Based on Salesforce's findLastElement
 */
export function findLastElement(
  nodeId: string,
  nodeMap: Map<string, FlowNode>
): FlowNode | undefined {
  let current = nodeMap.get(nodeId);
  while (current?.next) {
    current = nodeMap.get(current.next);
  }
  return current;
}

/**
 * Check if all branches are terminals
 * Based on Salesforce's areAllBranchesTerminals
 */
export function areAllBranchesTerminals(
  node: FlowNode,
  nodeMap: Map<string, FlowNode>
): boolean {
  if (!node.children) return false;

  return node.children.every((childId) => {
    if (!childId) return true; // Empty branch is considered terminal
    const lastNode = findLastElement(childId, nodeMap);
    return lastNode?.isTerminal === true || lastNode?.type === "END";
  });
}

// ============================================================================
// FLOW MODEL HELPERS
// Based on Salesforce's resolveNode, resolveParent, etc.
// ============================================================================

/**
 * Resolve a node by ID
 */
export function resolveNode(
  nodeId: string,
  nodeMap: Map<string, FlowNode>
): FlowNode | undefined {
  return nodeMap.get(nodeId);
}

/**
 * Find parent element of a node
 */
export function findParentElement(
  node: FlowNode,
  nodeMap: Map<string, FlowNode>
): FlowNode | undefined {
  if (node.parent) {
    return nodeMap.get(node.parent);
  }
  if (node.prev) {
    return nodeMap.get(node.prev);
  }
  return undefined;
}

/**
 * Check if going back to ancestor loop
 * Based on Salesforce's isGoingBackToAncestorLoop
 */
export function isGoingBackToAncestorLoop(
  targetId: string,
  sourceNode: FlowNode,
  nodeMap: Map<string, FlowNode>
): boolean {
  let current: FlowNode | undefined = sourceNode;

  while (current) {
    if (current.type === "LOOP" && current.id === targetId) {
      return true;
    }
    current = findParentElement(current, nodeMap);
  }

  return false;
}

// Export helper functions for potential use by other modules
export {
  _isBranchingNode as isBranchingNode,
  _supportsChildren as supportsChildren,
  _getChildCount as getChildCount,
  createIncomingMap,
};

export default autoLayout;
