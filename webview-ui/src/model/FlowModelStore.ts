/**
 * Flow Model Store
 *
 * Centralized store for flow node resolution and traversal.
 * Follows Salesforce's pattern of normalized store with helper methods
 * like resolveNode, resolveParent, findFirstElement, etc.
 *
 * Based on:
 * - alcConversionUtils.js: Graph traversal patterns
 * - alcCanvasUtils.js: Node type detection
 * - autoLayoutCanvas: Node resolution utilities
 */

import type { FlowNode, FlowEdge, NodeType } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowModelStoreOptions {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface BranchInfo {
  headNodeId: string | null;
  edge: FlowEdge;
  index: number;
}

// ============================================================================
// FLOW MODEL STORE CLASS
// ============================================================================

/**
 * FlowModelStore provides a centralized way to access and traverse flow nodes.
 *
 * This class mirrors Salesforce's internal flow model patterns where nodes
 * have relationships (next, prev, parent, children, fault) and the store
 * provides helper methods to resolve and traverse these relationships.
 */
export class FlowModelStore {
  private nodeMap: Map<string, FlowNode>;
  private edgeMap: Map<string, FlowEdge>;
  private outgoingEdges: Map<string, FlowEdge[]>;
  private incomingEdges: Map<string, FlowEdge[]>;

  constructor(options: FlowModelStoreOptions) {
    const { nodes, edges } = options;

    // Build node map
    this.nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Build edge map
    this.edgeMap = new Map(edges.map((e) => [e.id, e]));

    // Build outgoing edges map
    this.outgoingEdges = new Map();
    edges.forEach((e) => {
      const list = this.outgoingEdges.get(e.source) || [];
      list.push(e);
      this.outgoingEdges.set(e.source, list);
    });

    // Build incoming edges map
    this.incomingEdges = new Map();
    edges.forEach((e) => {
      const list = this.incomingEdges.get(e.target) || [];
      list.push(e);
      this.incomingEdges.set(e.target, list);
    });
  }

  // ==========================================================================
  // NODE RESOLUTION
  // Based on Salesforce's resolveNode, resolveBranchHead patterns
  // ==========================================================================

  /**
   * Resolve a node by ID
   */
  resolveNode(nodeId: string | undefined | null): FlowNode | undefined {
    if (!nodeId) return undefined;
    return this.nodeMap.get(nodeId);
  }

  /**
   * Resolve parent element of a node
   * Based on Salesforce's resolveParent
   */
  resolveParent(node: FlowNode): FlowNode | undefined {
    if (node.parent) {
      return this.nodeMap.get(node.parent);
    }
    if (node.prev) {
      return this.nodeMap.get(node.prev);
    }
    return undefined;
  }

  /**
   * Resolve branch head for a child reference
   * Based on Salesforce's resolveBranchHead
   */
  resolveBranchHead(branchId: string | null): FlowNode | undefined {
    if (!branchId) return undefined;
    return this.nodeMap.get(branchId);
  }

  /**
   * Resolve child at a specific index
   * Based on Salesforce's resolveChild
   */
  resolveChild(parentNode: FlowNode, childIndex: number): FlowNode | undefined {
    const childId = parentNode.children?.[childIndex];
    if (!childId) return undefined;
    return this.nodeMap.get(childId);
  }

  // ==========================================================================
  // ELEMENT FINDING
  // Based on Salesforce's findFirstElement, findLastElement
  // ==========================================================================

  /**
   * Find the first element in a branch (trace back via prev)
   * Based on Salesforce's findFirstElement
   */
  findFirstElement(nodeId: string): FlowNode | undefined {
    let current = this.nodeMap.get(nodeId);
    while (current?.prev) {
      current = this.nodeMap.get(current.prev);
    }
    return current;
  }

  /**
   * Find the last element in a branch (trace forward via next)
   * Based on Salesforce's findLastElement
   */
  findLastElement(nodeId: string): FlowNode | undefined {
    let current = this.nodeMap.get(nodeId);
    while (current?.next) {
      const next = this.nodeMap.get(current.next);
      if (!next) break;
      current = next;
    }
    return current;
  }

  /**
   * Find the start element in the flow
   */
  findStartElement(): FlowNode | undefined {
    return Array.from(this.nodeMap.values()).find(
      (node) => node.type === "START"
    );
  }

  /**
   * Find parent group of a node (if grouping is implemented)
   * Based on Salesforce's findParentGroup
   */
  findParentGroup(nodeId: string): FlowNode | undefined {
    let current = this.nodeMap.get(nodeId);

    while (current) {
      if (current.type === ("GROUP" as NodeType)) {
        return current;
      }
      current = this.resolveParent(current);
    }

    return undefined;
  }

  // ==========================================================================
  // EDGE QUERIES
  // ==========================================================================

  /**
   * Get all outgoing edges for a node
   */
  getOutgoingEdges(nodeId: string): FlowEdge[] {
    return this.outgoingEdges.get(nodeId) || [];
  }

  /**
   * Get all incoming edges for a node
   */
  getIncomingEdges(nodeId: string): FlowEdge[] {
    return this.incomingEdges.get(nodeId) || [];
  }

  /**
   * Get non-fault outgoing edges
   */
  getPrimaryOutgoingEdges(nodeId: string): FlowEdge[] {
    return this.getOutgoingEdges(nodeId).filter(
      (e) => e.type !== "fault" && e.type !== "fault-end"
    );
  }

  /**
   * Get fault edges for a node
   */
  getFaultEdges(nodeId: string): FlowEdge[] {
    return this.getOutgoingEdges(nodeId).filter(
      (e) => e.type === "fault" || e.type === "fault-end"
    );
  }

  /**
   * Get branch edges for a branching node
   */
  getBranchEdges(node: FlowNode): FlowEdge[] {
    const outs = this.getPrimaryOutgoingEdges(node.id);

    if (node.type === "LOOP") {
      return outs.filter(
        (e) => e.type === "loop-next" || e.type === "loop-end"
      );
    }

    if (
      node.type === "DECISION" ||
      node.type === "WAIT" ||
      node.type === "START"
    ) {
      return outs;
    }

    return [];
  }

  // ==========================================================================
  // BRANCH ANALYSIS
  // Based on Salesforce's areAllBranchesTerminals, hasGoToOnNext, etc.
  // ==========================================================================

  /**
   * Check if all branches from a node are terminals
   * Based on Salesforce's areAllBranchesTerminals
   */
  areAllBranchesTerminals(node: FlowNode): boolean {
    if (!node.children) return false;

    return node.children.every((childId) => {
      if (!childId) return true; // Empty branch is considered terminal
      const lastNode = this.findLastElement(childId);
      return lastNode?.isTerminal === true || lastNode?.type === "END";
    });
  }

  /**
   * Check if node has GoTo on next connection
   * Based on Salesforce's hasGoToOnNext
   */
  hasGoToOnNext(node: FlowNode): boolean {
    if (!node.next) return false;

    const nextEdge = this.getOutgoingEdges(node.id).find(
      (e) => e.target === node.next && e.type !== "fault"
    );

    return nextEdge?.isGoTo === true;
  }

  /**
   * Check if node has GoTo on branch head at index
   * Based on Salesforce's hasGoToOnBranchHead
   */
  hasGoToOnBranchHead(nodeId: string, childIndex: number): boolean {
    const node = this.nodeMap.get(nodeId);
    if (!node?.children) return false;

    const childId = node.children[childIndex];
    if (!childId) return false;

    const branchEdge = this.getOutgoingEdges(nodeId).find(
      (e) => e.target === childId
    );

    return branchEdge?.isGoTo === true;
  }

  /**
   * Check if going back to an ancestor loop
   * Based on Salesforce's isGoingBackToAncestorLoop
   */
  isGoingBackToAncestorLoop(targetId: string, sourceNode: FlowNode): boolean {
    let current: FlowNode | undefined = sourceNode;

    while (current) {
      if (current.type === "LOOP" && current.id === targetId) {
        return true;
      }
      current = this.resolveParent(current);
    }

    return false;
  }

  // ==========================================================================
  // NODE TYPE HELPERS
  // Based on Salesforce's isBranchingElement, supportsChildren, etc.
  // ==========================================================================

  /**
   * Check if a node supports branching
   */
  isBranchingNode(node: FlowNode): boolean {
    switch (node.type) {
      case "DECISION":
      case "WAIT":
      case "LOOP":
        return true;
      case "START":
        return (node.children && node.children.length > 1) || false;
      default:
        return false;
    }
  }

  /**
   * Check if a node supports children
   */
  supportsChildren(node: FlowNode): boolean {
    return ["DECISION", "WAIT", "LOOP", "START"].includes(node.type);
  }

  /**
   * Get child count for a node
   */
  getChildCount(node: FlowNode): number | null {
    if (node.type === "LOOP") return 1;

    if (["DECISION", "WAIT", "START"].includes(node.type)) {
      const childRefs = node.children || [];
      return childRefs.length;
    }

    return null;
  }

  // ==========================================================================
  // TRAVERSAL HELPERS
  // ==========================================================================

  /**
   * Iterate through all nodes in a branch
   */
  forEachInBranch(
    startId: string,
    callback: (node: FlowNode) => void | boolean,
    visited = new Set<string>()
  ): void {
    let current = this.nodeMap.get(startId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      const shouldStop = callback(current);
      if (shouldStop === true) break;

      if (current.next) {
        current = this.nodeMap.get(current.next);
      } else {
        break;
      }
    }
  }

  /**
   * Calculate depth of a branch
   */
  getBranchDepth(
    startId: string,
    stopAt?: string,
    visited = new Set<string>()
  ): number {
    if (!startId || visited.has(startId)) return 0;
    if (stopAt && startId === stopAt) return 0;

    const node = this.nodeMap.get(startId);
    if (!node) return 0;

    visited.add(startId);

    const outs = this.getPrimaryOutgoingEdges(startId);
    if (outs.length === 0) return 1;

    // Handle branching nodes
    if (this.isBranchingNode(node)) {
      const branchTargets = outs.map((e) => e.target);
      const mergePoint = this.findMergePoint(branchTargets);

      let maxBranchDepth = 0;
      outs.forEach((e) => {
        const depth = this.getBranchDepth(
          e.target,
          mergePoint,
          new Set(visited)
        );
        maxBranchDepth = Math.max(maxBranchDepth, depth);
      });

      const afterMerge = mergePoint
        ? this.getBranchDepth(mergePoint, stopAt, new Set(visited))
        : 0;

      return 1 + maxBranchDepth + afterMerge;
    }

    // Linear node
    return 1 + this.getBranchDepth(outs[0].target, stopAt, visited);
  }

  /**
   * Find merge point for multiple branches
   * Based on Salesforce's BFS approach
   */
  findMergePoint(branchTargets: string[]): string | undefined {
    if (branchTargets.length < 2) return undefined;

    // BFS from each branch to find common reachable nodes
    const reachable = branchTargets.map((target) => {
      const reached = new Map<string, number>();
      const queue: { id: string; depth: number }[] = [{ id: target, depth: 0 }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        reached.set(id, depth);

        const outs = this.getPrimaryOutgoingEdges(id);
        outs.forEach((e) => queue.push({ id: e.target, depth: depth + 1 }));
      }

      return reached;
    });

    // Find closest common node
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

  // ==========================================================================
  // COLLECTION ACCESS
  // ==========================================================================

  /**
   * Get all nodes
   */
  getAllNodes(): FlowNode[] {
    return Array.from(this.nodeMap.values());
  }

  /**
   * Get all edges
   */
  getAllEdges(): FlowEdge[] {
    return Array.from(this.edgeMap.values());
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodeMap.size;
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    return this.edgeMap.size;
  }

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodeMap.has(nodeId);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new FlowModelStore instance
 */
export function createFlowModelStore(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowModelStore {
  return new FlowModelStore({ nodes, edges });
}

export default FlowModelStore;
