/**
 * Tree Layout Engine
 *
 * Main layout engine that positions flow nodes using a tree-based algorithm.
 * This implements Salesforce's auto-layout canvas pattern.
 *
 * Based on Salesforce's calculateFlowLayout and renderFlow
 * from alcConversionUtils.js and alcFlow.js
 */

import type { FlowNode, FlowEdge, LayoutConfig } from "../types";
import {
  createIncomingMap,
  createNodeMap,
  createOutgoingMap,
} from "./layoutHelpers";
import { findMergePointForBranches } from "./mergePointFinder";
import {
  calculateBranchDepth,
  calculateSubtreeWidth,
} from "./branchCalculator";
import { getBranchEdgesForNode, sortBranchEdges } from "../utils/graph";
import { DEFAULT_LAYOUT_CONFIG } from "./layoutConfig";

export interface AutoLayoutOptions {
  config?: LayoutConfig;
  startNodeId?: string;
}

export interface LayoutResult {
  nodes: FlowNode[];
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Tree Layout Engine
 *
 * Positions nodes using a tree-based algorithm that:
 * 1. Builds position maps for nodes
 * 2. Handles branching (Decision, Wait) and looping (Loop) nodes
 * 3. Calculates merge points for branch convergence
 * 4. Positions fault paths to the right
 */
export class TreeLayoutEngine {
  private config: LayoutConfig;
  private nodeMap: Map<string, FlowNode>;
  private outgoing: Map<string, FlowEdge[]>;
  private incoming: Map<string, FlowEdge[]>;
  private faultOnlyNodes: Set<string>;
  private positions: Map<string, { x: number; y: number }>;
  private maxFaultX: number;
  private contentMaxRight: number;
  private faultTargetPositioned: Set<string>;

  constructor(
    nodes: FlowNode[],
    edges: FlowEdge[],
    options: AutoLayoutOptions = {}
  ) {
    this.config = options.config || DEFAULT_LAYOUT_CONFIG;
    this.nodeMap = createNodeMap(nodes);
    this.outgoing = createOutgoingMap(edges);
    this.incoming = createIncomingMap(edges);
    this.faultOnlyNodes = this.identifyFaultOnlyNodes(nodes);
    this.positions = new Map();
    this.maxFaultX = this.config.start.x + this.getColWidth();
    this.contentMaxRight = this.config.start.x + this.config.node.width / 2;
    this.faultTargetPositioned = new Set();
  }

  private getColWidth(): number {
    return this.config.node.width + this.config.grid.hGap;
  }

  private getNodeWidth(nodeId: string): number {
    const node = this.nodeMap.get(nodeId);
    return node?.width || this.config.node.width;
  }

  private identifyFaultOnlyNodes(nodes: FlowNode[]): Set<string> {
    const result = new Set<string>();

    nodes.forEach((node) => {
      if (node.type === "START") return;
      const incomingEdges = this.incoming.get(node.id) || [];
      if (
        incomingEdges.length > 0 &&
        incomingEdges.every(
          (edge) => edge.type === "fault" || edge.type === "fault-end"
        )
      ) {
        result.add(node.id);
      } else if (
        incomingEdges.length === 0 &&
        node.data?.isFaultPath === true
      ) {
        // End nodes generated for fault paths won't have incoming edges yet
        result.add(node.id);
      }
    });

    return result;
  }

  private getNodeHeight(nodeId: string): number {
    const node = this.nodeMap.get(nodeId);
    return node?.height || this.config.node.height;
  }

  private updateContentMaxRight(nodeId: string, centerX: number): void {
    if (this.faultOnlyNodes.has(nodeId)) return;
    const halfWidth = this.getNodeWidth(nodeId) / 2;
    this.contentMaxRight = Math.max(this.contentMaxRight, centerX + halfWidth);
  }
  /**
   * Layout all nodes starting from the start node
   */
  layout(
    startNodeId: string = "START_NODE"
  ): Map<string, { x: number; y: number }> {
    this.layoutNode(startNodeId, this.config.start.x, this.config.start.y);

    // Handle orphaned nodes
    this.layoutOrphanedNodes();

    return this.positions;
  }

  /**
   * Recursively layout nodes starting from nodeId
   */
  private layoutNode(
    nodeId: string,
    centerX: number,
    currentY: number,
    stopAt?: string,
    localVisited = new Set<string>()
  ): number {
    if (!nodeId || localVisited.has(nodeId)) return currentY;
    if (stopAt && nodeId === stopAt) return currentY;

    const node = this.nodeMap.get(nodeId);
    if (!node) return currentY;

    localVisited.add(nodeId);

    // Position this node
    this.positions.set(nodeId, { x: centerX, y: currentY });
    this.updateContentMaxRight(nodeId, centerX);

    // Calculate Y position for next node
    const nodeHeight = this.getNodeHeight(nodeId);
    // Add extra vertical gap after START nodes with multiple branches (scheduled paths)
    const outs = this.outgoing.get(nodeId) || [];
    const isStartWithBranches = node.type === "START" && outs.length > 1;
    const extraGap = isStartWithBranches ? 30 : 0;
    const nextY = currentY + nodeHeight + this.config.grid.vGap + extraGap;

    // Filter outgoing edges to non-fault
    const nonFaultOuts = outs.filter(
      (e) => e.type !== "fault" && e.type !== "fault-end"
    );

    // Handle fault paths
    this.layoutFaultPaths(nodeId, centerX, currentY, nodeHeight, localVisited);

    if (nonFaultOuts.length === 0) return nextY;

    // Route to appropriate layout method based on node type
    return this.layoutByNodeType(
      node,
      nonFaultOuts,
      centerX,
      currentY,
      nextY,
      stopAt,
      localVisited
    );
  }

  /**
   * Layout based on node type
   */
  private layoutByNodeType(
    node: FlowNode,
    outs: FlowEdge[],
    centerX: number,
    _currentY: number,
    nextY: number,
    stopAt?: string,
    localVisited = new Set<string>()
  ): number {
    const nodeType = node.type;
    const isBranchingStart = nodeType === "START" && outs.length > 1;

    if (nodeType === "DECISION" || nodeType === "WAIT" || isBranchingStart) {
      return this.layoutBranchingNode(
        node,
        outs,
        centerX,
        nextY,
        stopAt,
        localVisited
      );
    } else if (nodeType === "LOOP") {
      return this.layoutLoopNode(
        node,
        outs,
        centerX,
        nextY,
        stopAt,
        localVisited
      );
    } else {
      return this.layoutLinearNode(outs, centerX, nextY, stopAt, localVisited);
    }
  }

  /**
   * Layout a branching node (Decision, Wait, or Start with multiple paths)
   */
  private layoutBranchingNode(
    node: FlowNode,
    outs: FlowEdge[],
    centerX: number,
    nextY: number,
    stopAt?: string,
    localVisited = new Set<string>()
  ): number {
    const branchEdges = sortBranchEdges(
      node,
      getBranchEdgesForNode(node, outs)
    );
    const branchTargets = branchEdges.map((e) => e.target);
    const mergePoint = findMergePointForBranches(
      branchTargets,
      this.outgoing,
      this.nodeMap
    );

    // Calculate widths of each branch
    const branchWidths = branchEdges.map((e) => {
      const width = calculateSubtreeWidth(
        e.target,
        this.nodeMap,
        this.outgoing,
        mergePoint,
        new Set(localVisited)
      );
      return Math.max(width, 1);
    });
    const totalWidth = branchWidths.reduce((a, b) => a + b, 0);

    // Position branches spread outward from parent's center
    const colWidth = this.getColWidth();
    let currentX = centerX - (totalWidth * colWidth) / 2 + colWidth / 2;
    let maxBranchDepth = 0;
    let firstBranchCenterX = centerX;
    let lastBranchCenterX = centerX;

    branchEdges.forEach((edge, idx) => {
      const branchWidth = branchWidths[idx];
      const branchCenterX = currentX + ((branchWidth - 1) * colWidth) / 2;

      if (idx === 0) firstBranchCenterX = branchCenterX;
      lastBranchCenterX = branchCenterX;

      const goesDirectlyToMerge = edge.target === mergePoint;

      if (!goesDirectlyToMerge && !localVisited.has(edge.target)) {
        this.layoutNode(
          edge.target,
          branchCenterX,
          nextY,
          mergePoint,
          new Set(localVisited)
        );
      }

      const branchDepth = calculateBranchDepth(
        edge.target,
        this.nodeMap,
        this.outgoing,
        mergePoint,
        new Set(localVisited)
      );
      maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

      currentX += branchWidth * colWidth;
    });

    // Position merge point centered between all branches
    if (mergePoint && !localVisited.has(mergePoint)) {
      const mergeCenterX = (firstBranchCenterX + lastBranchCenterX) / 2;
      const mergeY =
        nextY +
        maxBranchDepth * (this.config.node.height + this.config.grid.vGap);
      this.layoutNode(mergePoint, mergeCenterX, mergeY, stopAt, localVisited);
    }

    return nextY;
  }

  /**
   * Layout a loop node
   */
  private layoutLoopNode(
    node: FlowNode,
    outs: FlowEdge[],
    centerX: number,
    nextY: number,
    stopAt?: string,
    localVisited = new Set<string>()
  ): number {
    const forEachEdge = outs.find((e) => e.type === "loop-next");
    const afterLastEdge = outs.find((e) => e.type === "loop-end");

    const loopBodyWidth = forEachEdge
      ? calculateSubtreeWidth(
          forEachEdge.target,
          this.nodeMap,
          this.outgoing,
          node.id,
          new Set(localVisited)
        )
      : 1;

    const colWidth = this.getColWidth();

    // Position "For Each" branch to the left
    if (forEachEdge && !localVisited.has(forEachEdge.target)) {
      const loopBodyX = centerX - colWidth * (loopBodyWidth / 2 + 0.5);
      this.layoutNode(
        forEachEdge.target,
        loopBodyX,
        nextY,
        node.id,
        new Set(localVisited)
      );
    }

    // Calculate loop body depth for "After Last" positioning
    const loopBodyDepth = forEachEdge
      ? calculateBranchDepth(
          forEachEdge.target,
          this.nodeMap,
          this.outgoing,
          node.id,
          new Set(localVisited)
        )
      : 1;

    // Position "After Last" below the loop
    if (afterLastEdge && !localVisited.has(afterLastEdge.target)) {
      const afterLoopY =
        nextY +
        loopBodyDepth * (this.config.node.height + this.config.grid.vGap);
      this.layoutNode(
        afterLastEdge.target,
        centerX,
        afterLoopY,
        stopAt,
        localVisited
      );
    }

    return nextY;
  }

  /**
   * Layout a linear (non-branching) node
   */
  private layoutLinearNode(
    outs: FlowEdge[],
    centerX: number,
    nextY: number,
    stopAt?: string,
    localVisited = new Set<string>()
  ): number {
    let lastY = nextY;
    outs.forEach((edge) => {
      if (!localVisited.has(edge.target)) {
        lastY = this.layoutNode(
          edge.target,
          centerX,
          nextY,
          stopAt,
          localVisited
        );
      }
    });
    return lastY;
  }

  /**
   * Layout fault paths to the right of the node
   */
  private layoutFaultPaths(
    nodeId: string,
    centerX: number,
    currentY: number,
    nodeHeight: number,
    localVisited: Set<string>
  ): void {
    const faultOuts = (this.outgoing.get(nodeId) || []).filter(
      (e) => e.type === "fault" || e.type === "fault-end"
    );

    if (faultOuts.length === 0) return;

    const sourceWidth = this.getNodeWidth(nodeId);
    const sourceRight = centerX + sourceWidth / 2;

    faultOuts.forEach((edge, faultIndex) => {
      const targetNode = this.nodeMap.get(edge.target);
      const targetWidth = targetNode?.width || this.config.node.width;
      const targetHeight = targetNode?.height || this.config.node.height;
      const isFaultEnd =
        edge.type === "fault-end" || targetNode?.type === "END";

      const incomingEdges = this.incoming.get(edge.target) || [];
      const hasNonFaultIncoming = incomingEdges.some(
        (incomingEdge) =>
          incomingEdge.type !== "fault" && incomingEdge.type !== "fault-end"
      );

      // Allow GoTo connectors to rely on the regular layout when the target is
      // already part of the primary path. Otherwise, fall back to fault layout.
      if (edge.isGoTo && hasNonFaultIncoming) {
        return;
      }

      if (this.faultTargetPositioned.has(edge.target) && !isFaultEnd) return;
      if (localVisited.has(edge.target)) return;

      const laneFromSource =
        sourceRight + this.config.grid.hGap + targetWidth / 2;
      const laneFromContent =
        this.contentMaxRight + this.config.grid.hGap + targetWidth / 2;
      const laneFromPrev =
        this.maxFaultX + (faultIndex ? targetWidth + this.config.grid.hGap : 0);
      const laneCenterX = Math.max(
        laneFromSource,
        laneFromContent,
        laneFromPrev
      );

      if (isFaultEnd) {
        // Position END node at same Y level for straight horizontal line
        const srcCenterY = currentY + nodeHeight / 2;
        const endNodeHeight = 40;
        const endNodeY = srcCenterY - endNodeHeight / 2;

        this.positions.set(edge.target, { x: laneCenterX, y: endNodeY });
        this.faultTargetPositioned.add(edge.target);
        localVisited.add(edge.target);
      } else {
        // Regular fault path target (assignment, screen, etc.)
        this.faultTargetPositioned.add(edge.target);

        const dropOffset = this.faultOnlyNodes.has(edge.target)
          ? nodeHeight + this.config.grid.vGap
          : 0;
        const stackOffset = faultIndex
          ? faultIndex * (targetHeight + Math.max(this.config.grid.vGap, 40))
          : 0;
        const targetY = currentY + dropOffset + stackOffset;

        this.layoutNode(
          edge.target,
          laneCenterX,
          targetY,
          undefined,
          new Set(localVisited)
        );
      }

      this.maxFaultX = Math.max(this.maxFaultX, laneCenterX + targetWidth / 2);
    });
  }

  /**
   * Layout any orphaned nodes that weren't reached from start
   */
  private layoutOrphanedNodes(): void {
    let maxY = this.config.start.y;
    this.positions.forEach((p) => {
      maxY = Math.max(maxY, p.y);
    });

    for (const [nodeId] of this.nodeMap) {
      if (!this.positions.has(nodeId)) {
        maxY += this.config.node.height + this.config.grid.vGap;
        this.positions.set(nodeId, {
          x: this.config.start.x + 400,
          y: maxY,
        });
      }
    }
  }
}

/**
 * Auto-layout flow nodes using a tree-based algorithm
 *
 * This is the main entry point for layout calculation.
 */
export function autoLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: AutoLayoutOptions = {}
): FlowNode[] {
  if (nodes.length === 0) return nodes;

  const startNodeId = options.startNodeId || "START_NODE";
  const engine = new TreeLayoutEngine(nodes, edges, options);
  const positions = engine.layout(startNodeId);

  // Apply positions to nodes (center horizontally)
  return nodes.map((n) => {
    const pos = positions.get(n.id) || {
      x: options.config?.start.x || DEFAULT_LAYOUT_CONFIG.start.x,
      y: options.config?.start.y || DEFAULT_LAYOUT_CONFIG.start.y,
    };
    return { ...n, x: pos.x - n.width / 2, y: pos.y };
  });
}

export default autoLayout;
