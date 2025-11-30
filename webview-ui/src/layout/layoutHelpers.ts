/**
 * Layout Helper Functions
 *
 * Utility functions for the layout engine including node maps,
 * edge maps, and flow model traversal helpers.
 *
 * Based on Salesforce's alcConversionUtils.js
 */

import type { FlowNode, FlowEdge, Geometry } from "../types";

// ============================================================================
// MAP CREATION HELPERS
// ============================================================================

/**
 * Create a map from node ID to node for quick lookups
 */
export function createNodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Create a map of outgoing edges for each node
 */
export function createOutgoingMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
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
export function createIncomingMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const incoming = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e);
  });
  return incoming;
}

// ============================================================================
// NODE TYPE HELPERS
// Based on Salesforce's alcCanvasUtils
// ============================================================================

/**
 * Check if a node is a branching node (has multiple outgoing paths)
 * Based on Salesforce's isBranchingElement and supportsBranching
 */
export function isBranchingNode(node: FlowNode): boolean {
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
export function supportsChildren(node: FlowNode): boolean {
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
export function getChildCount(node: FlowNode): number | null {
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
