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
import { FAULT_LANE_CLEARANCE } from "../constants/dimensions";

export interface AutoLayoutOptions {
  config?: LayoutConfig;
  startNodeId?: string;
}

export interface LayoutResult {
  nodes: FlowNode[];
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Fault lane assignment info - used to ensure consistent routing
 * Based on Salesforce's approach of assigning each fault a global lane
 */
export interface FaultLaneInfo {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceY: number;
  targetY: number;
  globalFaultIndex: number; // Global index across all faults in the flow
  laneX: number; // The X position of the dedicated lane for this fault
}

/**
 * Tree Layout Engine
 *
 * Positions nodes using a tree-based algorithm that:
 * 1. Builds position maps for nodes
 * 2. Handles branching (Decision, Wait) and looping (Loop) nodes
 * 3. Calculates merge points for branch convergence
 * 4. Positions fault paths to the right using dedicated lanes (Salesforce pattern)
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
  
  // New: Global fault lane tracking (Salesforce pattern)
  private faultLanes: Map<string, FaultLaneInfo>; // edgeId -> lane info
  private faultLaneBaseX: number; // Base X position for the fault lane area
  private allEdges: FlowEdge[]; // Keep reference to all edges for lane calculation

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
    
    // Initialize global fault lane tracking
    this.faultLanes = new Map();
    this.faultLaneBaseX = this.config.start.x + this.config.node.width / 2 + FAULT_LANE_CLEARANCE;
    this.allEdges = edges;
    
    // Pre-calculate fault lanes based on flow traversal order
    this.preCalculateFaultLanesInFlowOrder();
  }
  
  /**
   * Pre-calculate fault lane assignments based on flow traversal order
   * This walks the flow in the same order as layout, ensuring faults encountered
   * earlier in the flow get lower lane indices (closer to the main content)
   * 
   * The algorithm also considers Y-range overlaps to prevent crossovers:
   * When two fault paths have overlapping Y ranges, they are assigned to
   * different lanes in a way that prevents crossing.
   */
  private preCalculateFaultLanesInFlowOrder(): void {
    const faultEdges = this.allEdges.filter(
      e => e.type === "fault" || e.type === "fault-end"
    );
    
    if (faultEdges.length === 0) return;
    
    // Build a map of source nodes to their fault edges
    const faultEdgesBySource = new Map<string, FlowEdge[]>();
    faultEdges.forEach(edge => {
      const list = faultEdgesBySource.get(edge.source) || [];
      list.push(edge);
      faultEdgesBySource.set(edge.source, list);
    });
    
    // Traverse the flow in order to collect faults in traversal order
    // Also track the traversal index for each node
    const orderedFaultEdges: FlowEdge[] = [];
    const visited = new Set<string>();
    const traversalOrder = new Map<string, number>();
    let traversalIndex = 0;
    
    const collectFaultsInOrder = (nodeId: string) => {
      if (!nodeId || visited.has(nodeId)) return;
      visited.add(nodeId);
      traversalOrder.set(nodeId, traversalIndex++);
      
      // Collect any fault edges from this node (in traversal order)
      const nodeFaults = faultEdgesBySource.get(nodeId);
      if (nodeFaults) {
        orderedFaultEdges.push(...nodeFaults);
      }
      
      // Continue traversal through non-fault edges
      const outs = this.outgoing.get(nodeId) || [];
      const nonFaultOuts = outs.filter(
        e => e.type !== "fault" && e.type !== "fault-end"
      );
      
      // Handle branching nodes - traverse branches in order
      const node = this.nodeMap.get(nodeId);
      if (node && (node.type === "DECISION" || node.type === "WAIT" || 
          (node.type === "START" && nonFaultOuts.length > 1))) {
        // For branching nodes, traverse branches left to right
        const sortedOuts = sortBranchEdges(node, nonFaultOuts);
        sortedOuts.forEach(edge => collectFaultsInOrder(edge.target));
      } else if (node && node.type === "LOOP") {
        // For loops, traverse loop body first, then next
        const loopBody = nonFaultOuts.find(e => e.type === "loop-next");
        const loopEnd = nonFaultOuts.find(e => e.type === "loop-end" || e.type !== "loop-next");
        if (loopBody) collectFaultsInOrder(loopBody.target);
        if (loopEnd) collectFaultsInOrder(loopEnd.target);
      } else {
        // Linear traversal
        nonFaultOuts.forEach(edge => collectFaultsInOrder(edge.target));
      }
    };
    
    // Start traversal from START_NODE
    collectFaultsInOrder("START_NODE");
    
    // Now assign lanes using a greedy interval scheduling approach
    // to avoid crossovers when Y ranges overlap
    
    // First, compute preliminary traversal indices for each fault edge
    interface FaultEdgeInfo {
      edge: FlowEdge;
      sourceIndex: number;  // Traversal order of source
      targetIndex: number;  // Traversal order of target (or Infinity if not in main flow)
      minIndex: number;     // Earlier of source/target
      maxIndex: number;     // Later of source/target
    }
    
    const faultInfos: FaultEdgeInfo[] = orderedFaultEdges.map(edge => {
      const srcIdx = traversalOrder.get(edge.source) ?? 0;
      const tgtIdx = traversalOrder.get(edge.target) ?? Infinity;
      return {
        edge,
        sourceIndex: srcIdx,
        targetIndex: tgtIdx,
        minIndex: Math.min(srcIdx, tgtIdx),
        maxIndex: Math.max(srcIdx, tgtIdx),
      };
    });
    
    // Sort by source index (flow order) - this is our primary ordering
    faultInfos.sort((a, b) => a.sourceIndex - b.sourceIndex);
    
    // Assign lanes to avoid overlaps
    // lanes[i] contains the maxIndex of the fault currently using lane i
    const lanes: number[] = [];
    
    faultInfos.forEach((info, _i) => {
      // Find the first lane where this fault won't overlap with existing faults
      // A fault can use a lane if its minIndex > lane's current maxIndex
      let assignedLane = -1;
      for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
        if (info.minIndex > lanes[laneIdx]) {
          // This lane is free (no overlap)
          assignedLane = laneIdx;
          lanes[laneIdx] = info.maxIndex;
          break;
        }
      }
      
      if (assignedLane === -1) {
        // Need a new lane
        assignedLane = lanes.length;
        lanes.push(info.maxIndex);
      }
      
      const laneOffset = assignedLane * 40; // 40px spacing between fault lanes
      const laneX = this.faultLaneBaseX + laneOffset;
      
      this.faultLanes.set(info.edge.id, {
        edgeId: info.edge.id,
        sourceId: info.edge.source,
        targetId: info.edge.target,
        sourceY: 0, // Will be updated after layout
        targetY: 0,
        globalFaultIndex: assignedLane,
        laneX: laneX,
      });
    });
  }
  
  /**
   * Get the fault lane info for an edge
   */
  getFaultLaneInfo(edgeId: string): FaultLaneInfo | undefined {
    return this.faultLanes.get(edgeId);
  }
  
  /**
   * Get all fault lane assignments
   */
  getAllFaultLanes(): Map<string, FaultLaneInfo> {
    return this.faultLanes;
  }

  private getColWidth(): number {
    return this.config.node.width + this.config.grid.hGap;
  }

  private getNodeWidth(nodeId: string): number {
    const node = this.nodeMap.get(nodeId);
    return node?.width || this.config.node.width;
  }

  private getFaultLaneGap(): number {
    return Math.max(FAULT_LANE_CLEARANCE, this.config.grid.hGap * 2);
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
   * Layout fault paths to the right of the node using dedicated lanes
   * Based on Salesforce's fault path layout pattern
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

    faultOuts.forEach((edge) => {
      const targetNode = this.nodeMap.get(edge.target);
      const targetWidth = targetNode?.width || this.config.node.width;
      const isFaultEnd =
        edge.type === "fault-end" || targetNode?.type === "END";

      const incomingEdges = this.incoming.get(edge.target) || [];
      const hasNonFaultIncoming = incomingEdges.some(
        (incomingEdge) =>
          incomingEdge.type !== "fault" && incomingEdge.type !== "fault-end"
      );

      // Allow GoTo connectors to rely on the regular layout when the target is
      // already part of the primary path.
      if (edge.isGoTo && hasNonFaultIncoming) {
        return;
      }

      if (this.faultTargetPositioned.has(edge.target) && !isFaultEnd) return;
      if (localVisited.has(edge.target)) return;

      // Get the pre-calculated fault lane for this edge
      const faultLaneInfo = this.faultLanes.get(edge.id);
      let laneCenterX: number;
      
      if (faultLaneInfo) {
        // Use the pre-calculated lane position
        laneCenterX = faultLaneInfo.laneX + targetWidth / 2;
        
        // Ensure the lane is far enough from the main content
        const minLaneX = Math.max(
          sourceRight + FAULT_LANE_CLEARANCE + targetWidth / 2,
          this.contentMaxRight + FAULT_LANE_CLEARANCE + targetWidth / 2
        );
        laneCenterX = Math.max(laneCenterX, minLaneX);
        
        // Update the lane info with the final position
        faultLaneInfo.laneX = laneCenterX - targetWidth / 2;
      } else {
        // Fallback for edges not in the pre-calculated map
        const faultLaneGap = this.getFaultLaneGap();
        const laneFromSource = sourceRight + faultLaneGap + targetWidth / 2;
        const laneFromContent = this.contentMaxRight + faultLaneGap + targetWidth / 2;
        laneCenterX = Math.max(laneFromSource, laneFromContent, this.maxFaultX);
      }

      if (isFaultEnd) {
        // Position END node at same Y level for straight horizontal line
        const srcCenterY = currentY + nodeHeight / 2;
        const endNodeHeight = 40;
        const endNodeY = srcCenterY - endNodeHeight / 2;

        this.positions.set(edge.target, { x: laneCenterX, y: endNodeY });
        this.faultTargetPositioned.add(edge.target);
        localVisited.add(edge.target);
      } else {
        // Regular fault path target
        this.faultTargetPositioned.add(edge.target);

        const dropOffset = this.faultOnlyNodes.has(edge.target)
          ? nodeHeight + this.config.grid.vGap
          : 0;
        const targetY = currentY + dropOffset;

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

/**
 * Extended auto-layout that also returns fault lane information
 * for use in edge rendering
 */
export function autoLayoutWithFaultLanes(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: AutoLayoutOptions = {}
): { nodes: FlowNode[]; faultLanes: Map<string, FaultLaneInfo> } {
  if (nodes.length === 0) return { nodes, faultLanes: new Map() };

  const startNodeId = options.startNodeId || "START_NODE";
  const engine = new TreeLayoutEngine(nodes, edges, options);
  const positions = engine.layout(startNodeId);
  const faultLanes = engine.getAllFaultLanes();

  // Apply positions to nodes (center horizontally)
  const layoutedNodes = nodes.map((n) => {
    const pos = positions.get(n.id) || {
      x: options.config?.start.x || DEFAULT_LAYOUT_CONFIG.start.x,
      y: options.config?.start.y || DEFAULT_LAYOUT_CONFIG.start.y,
    };
    return { ...n, x: pos.x - n.width / 2, y: pos.y };
  });

  // Update fault lane info with actual node positions
  faultLanes.forEach((lane) => {
    const srcNode = layoutedNodes.find(n => n.id === lane.sourceId);
    const tgtNode = layoutedNodes.find(n => n.id === lane.targetId);
    if (srcNode) {
      lane.sourceY = srcNode.y + srcNode.height / 2;
    }
    if (tgtNode) {
      lane.targetY = tgtNode.y + tgtNode.height / 2;
    }
  });

  return { nodes: layoutedNodes, faultLanes };
}

export default autoLayout;
