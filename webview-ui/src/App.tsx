import React, { useState, useEffect, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  FileCode,
  Layout,
  Monitor,
  Database,
  GitBranch,
  Play,
  Repeat,
  CheckSquare,
  Info,
  Search,
  Zap,
  Clock,
  Code,
  Home,
  ChevronLeft,
  ChevronRight,
  Edit3,
  AlertTriangle,
  ChevronLeftCircle,
  ChevronRightCircle,
  Circle,
} from "lucide-react";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode =
  typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

// ============================================================================
// TYPES
// ============================================================================
type NodeType =
  | "START"
  | "SCREEN"
  | "DECISION"
  | "ASSIGNMENT"
  | "LOOP"
  | "RECORD_CREATE"
  | "RECORD_UPDATE"
  | "RECORD_LOOKUP"
  | "RECORD_DELETE"
  | "ACTION"
  | "SUBFLOW"
  | "WAIT"
  | "CUSTOM_ERROR"
  | "END";

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: "normal" | "fault" | "loop-next" | "loop-end" | "fault-end";
}

interface ParsedFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: { label?: string; apiVersion?: string; processType?: string };
}

// ============================================================================
// CONSTANTS - Salesforce-style layout parameters
// ============================================================================
const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;

// Salesforce-style spacing (based on their default layout config)
const GRID_H_GAP = 80; // Horizontal gap between adjacent nodes (wider for complex flows)
const GRID_V_GAP = 80; // Vertical gap between rows
const START_X = 800; // Canvas center X (increased for wider flows)
const START_Y = 80; // Canvas top Y

const NODE_CONFIG: Record<
  NodeType,
  { color: string; icon: React.ElementType; label: string }
> = {
  START: { color: "#22c55e", icon: Play, label: "Start" },
  SCREEN: { color: "#3b82f6", icon: Monitor, label: "Screen" },
  DECISION: { color: "#f59e0b", icon: GitBranch, label: "Decision" },
  ASSIGNMENT: { color: "#f97316", icon: CheckSquare, label: "Assignment" },
  LOOP: { color: "#ec4899", icon: Repeat, label: "Loop" },
  RECORD_CREATE: { color: "#ef4444", icon: Database, label: "Create Records" },
  RECORD_UPDATE: { color: "#f59e0b", icon: Edit3, label: "Update Records" },
  RECORD_LOOKUP: { color: "#ef4444", icon: Search, label: "Get Records" },
  RECORD_DELETE: { color: "#dc2626", icon: Database, label: "Delete Records" },
  ACTION: { color: "#06b6d4", icon: Zap, label: "Action" },
  SUBFLOW: { color: "#8b5cf6", icon: Code, label: "Subflow" },
  WAIT: { color: "#eab308", icon: Clock, label: "Wait" },
  CUSTOM_ERROR: {
    color: "#dc2626",
    icon: AlertTriangle,
    label: "Custom Error",
  },
  END: { color: "#ef4444", icon: Circle, label: "End" },
};

// ============================================================================
// DEMO XML
// ============================================================================
const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>57.0</apiVersion>
    <label>Sample Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector><targetReference>Get_Records</targetReference></connector>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <recordLookups>
        <name>Get_Records</name>
        <label>Get Records</label>
        <locationX>176</locationX>
        <locationY>150</locationY>
        <connector><targetReference>Check_Condition</targetReference></connector>
        <object>Contact</object>
    </recordLookups>
    <decisions>
        <name>Check_Condition</name>
        <label>Check Condition</label>
        <locationX>176</locationX>
        <locationY>280</locationY>
        <defaultConnector><targetReference>Update_Record</targetReference></defaultConnector>
        <defaultConnectorLabel>No Match</defaultConnectorLabel>
        <rules>
            <name>Match_Found</name>
            <conditionLogic>and</conditionLogic>
            <connector><targetReference>Create_Record</targetReference></connector>
            <label>Match Found</label>
        </rules>
    </decisions>
    <recordCreates>
        <name>Create_Record</name>
        <label>Create Record</label>
        <locationX>50</locationX>
        <locationY>450</locationY>
        <object>Task</object>
    </recordCreates>
    <recordUpdates>
        <name>Update_Record</name>
        <label>Update Record</label>
        <locationX>300</locationX>
        <locationY>450</locationY>
    </recordUpdates>
</Flow>`;

// ============================================================================
// XML PARSER
// ============================================================================
function parseFlowXML(xmlText: string): ParsedFlow {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const metadata: ParsedFlow["metadata"] = {};

  const getText = (el: Element, tag: string) =>
    el.getElementsByTagName(tag)[0]?.textContent || "";

  // Metadata
  const flowEl = doc.getElementsByTagName("Flow")[0];
  if (flowEl) {
    for (const child of Array.from(flowEl.children)) {
      if (child.tagName === "label") metadata.label = child.textContent || "";
      if (child.tagName === "apiVersion")
        metadata.apiVersion = child.textContent || "";
      if (child.tagName === "processType")
        metadata.processType = child.textContent || "";
    }
  }

  // Start node
  const startEl = doc.getElementsByTagName("start")[0];
  if (startEl) {
    const triggerType = getText(startEl, "triggerType");
    const obj = getText(startEl, "object");
    const recTrigger = getText(startEl, "recordTriggerType");

    let startLabel = "Start";
    if (
      triggerType === "RecordAfterSave" ||
      triggerType === "RecordBeforeSave"
    ) {
      startLabel = "Record-Triggered Flow";
    } else if (triggerType === "Scheduled") {
      startLabel = "Scheduled Flow";
    }

    nodes.push({
      id: "START_NODE",
      type: "START",
      label: startLabel,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT + 24,
      data: { object: obj, triggerType, recordTriggerType: recTrigger },
    });

    const conn = startEl.getElementsByTagName("connector")[0];
    if (conn) {
      const target = getText(conn, "targetReference");
      if (target)
        edges.push({
          id: `start-${target}`,
          source: "START_NODE",
          target,
          type: "normal",
        });
    }

    // Scheduled paths
    const scheduledPaths = startEl.getElementsByTagName("scheduledPaths");
    for (let i = 0; i < scheduledPaths.length; i++) {
      const path = scheduledPaths[i];
      const pathLabel = getText(path, "label") || getText(path, "name");
      const pathConn = path.getElementsByTagName("connector")[0];
      if (pathConn) {
        const target = getText(pathConn, "targetReference");
        if (target)
          edges.push({
            id: `start-${target}-sched-${i}`,
            source: "START_NODE",
            target,
            label: pathLabel,
            type: "normal",
          });
      }
    }
  }

  // Element types to parse
  const elementTypes: { tag: string; type: NodeType }[] = [
    { tag: "screens", type: "SCREEN" },
    { tag: "decisions", type: "DECISION" },
    { tag: "assignments", type: "ASSIGNMENT" },
    { tag: "loops", type: "LOOP" },
    { tag: "recordCreates", type: "RECORD_CREATE" },
    { tag: "recordUpdates", type: "RECORD_UPDATE" },
    { tag: "recordLookups", type: "RECORD_LOOKUP" },
    { tag: "recordDeletes", type: "RECORD_DELETE" },
    { tag: "actionCalls", type: "ACTION" },
    { tag: "subflows", type: "SUBFLOW" },
    { tag: "waits", type: "WAIT" },
    { tag: "customErrors", type: "CUSTOM_ERROR" },
  ];

  for (const { tag, type } of elementTypes) {
    const elements = doc.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const name = getText(el, "name");
      const label = getText(el, "label") || name;
      const obj = getText(el, "object");

      nodes.push({
        id: name,
        type,
        label,
        x: 0,
        y: 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: { xmlElement: el.outerHTML, object: obj },
      });

      // Standard connector
      for (const child of Array.from(el.children)) {
        if (child.tagName === "connector") {
          const target = getText(child, "targetReference");
          if (target)
            edges.push({
              id: `${name}-${target}`,
              source: name,
              target,
              type: "normal",
            });
        }
      }

      // Fault connector
      const faultConn = el.getElementsByTagName("faultConnector")[0];
      if (faultConn) {
        const target = getText(faultConn, "targetReference");
        if (target)
          edges.push({
            id: `${name}-${target}-fault`,
            source: name,
            target,
            label: "Fault",
            type: "fault",
          });
      }

      // Decision rules
      if (type === "DECISION") {
        const rules = el.getElementsByTagName("rules");
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          const ruleLabel = getText(rule, "label") || getText(rule, "name");
          for (const rc of Array.from(rule.children)) {
            if (rc.tagName === "connector") {
              const target = getText(rc, "targetReference");
              if (target)
                edges.push({
                  id: `${name}-${target}-rule-${j}`,
                  source: name,
                  target,
                  label: ruleLabel,
                  type: "normal",
                });
            }
          }
        }
        const defConn = el.getElementsByTagName("defaultConnector")[0];
        if (defConn) {
          const target = getText(defConn, "targetReference");
          const defLabel = getText(el, "defaultConnectorLabel") || "Default";
          if (target)
            edges.push({
              id: `${name}-${target}-def`,
              source: name,
              target,
              label: defLabel,
              type: "normal",
            });
        }
      }

      // Loop connectors
      if (type === "LOOP") {
        const nextConn = el.getElementsByTagName("nextValueConnector")[0];
        if (nextConn) {
          const target = getText(nextConn, "targetReference");
          if (target)
            edges.push({
              id: `${name}-${target}-next`,
              source: name,
              target,
              label: "For Each",
              type: "loop-next",
            });
        }
        const endConn = el.getElementsByTagName("noMoreValuesConnector")[0];
        if (endConn) {
          const target = getText(endConn, "targetReference");
          if (target)
            edges.push({
              id: `${name}-${target}-end`,
              source: name,
              target,
              label: "After Last",
              type: "loop-end",
            });
        }
      }

      // Wait events
      if (type === "WAIT") {
        const waitEvents = el.getElementsByTagName("waitEvents");
        for (let j = 0; j < waitEvents.length; j++) {
          const we = waitEvents[j];
          const weLabel = getText(we, "label") || getText(we, "name");
          const weConn = we.getElementsByTagName("connector")[0];
          if (weConn) {
            const target = getText(weConn, "targetReference");
            if (target)
              edges.push({
                id: `${name}-${target}-wait-${j}`,
                source: name,
                target,
                label: weLabel,
                type: "normal",
              });
          }
        }
        const defConn = el.getElementsByTagName("defaultConnector")[0];
        if (defConn) {
          const target = getText(defConn, "targetReference");
          const defLabel = getText(el, "defaultConnectorLabel") || "Default";
          if (target)
            edges.push({
              id: `${name}-${target}-def`,
              source: name,
              target,
              label: defLabel,
              type: "normal",
            });
        }
      }
    }
  }

  // Find terminal nodes (nodes with no outgoing connections) and add END nodes
  const nodesWithOutgoing = new Set(edges.map((e) => e.source));
  let endNodeCount = 0;

  // Track nodes reached via fault connectors
  const faultReachedNodes = new Set<string>();
  edges.forEach((e) => {
    if (e.type === "fault") {
      faultReachedNodes.add(e.target);
    }
  });

  // Store terminal nodes first (before modifying nodes array)
  const terminalNodes = nodes.filter(
    (node) => !nodesWithOutgoing.has(node.id) && node.type !== "START"
  );

  terminalNodes.forEach((node) => {
    // This node has no outgoing edges - add an END node after it
    const endNodeId = `END_NODE_${endNodeCount++}`;
    const isFaultPath = faultReachedNodes.has(node.id);

    nodes.push({
      id: endNodeId,
      type: "END",
      label: "End",
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: 40,
      data: { isFaultPath }, // Mark if this END is on a fault path
    });
    edges.push({
      id: `${node.id}-${endNodeId}`,
      source: node.id,
      target: endNodeId,
      type: isFaultPath ? "fault-end" : "normal", // Special type for fault-path ends
    });
  });

  return { nodes, edges, metadata };
}

// ============================================================================
// AUTO LAYOUT - Salesforce-style Tree Layout
// ============================================================================
// 
// Key principles from Salesforce's approach:
// 1. Build a tree structure with branches from decision/wait/loop nodes
// 2. Calculate width of each subtree recursively
// 3. Position branches symmetrically around parent's X position
// 4. Track merge points where branches converge
// 5. Use consistent spacing with clear visual hierarchy

interface LayoutNode {
  id: string;
  node: FlowNode;
  children: LayoutBranch[];
  mergePoint?: string; // The node where branches merge
  depth: number; // Depth within current branch (for vertical position)
  subtreeWidth: number; // Width of subtree in grid units
  x: number; // Final X position
  y: number; // Final Y position
  parent?: LayoutNode;
  branchIndex?: number; // Which branch this node belongs to
}

interface LayoutBranch {
  label?: string;
  target: string;
  edge: FlowEdge;
  nodes: LayoutNode[];
  width: number; // Width in grid units
  depth: number; // Maximum depth of this branch
  terminates: boolean; // Whether this branch ends (no merge)
}

function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, FlowEdge[]>();
  const incoming = new Map<string, FlowEdge[]>();

  edges.forEach((e) => {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e);
  });

  // Detect merge points - nodes that have multiple incoming normal edges
  const mergePoints = new Map<string, string[]>(); // mergeId -> source node ids
  incoming.forEach((inEdges, nodeId) => {
    const normalIncoming = inEdges.filter(
      (e) => e.type !== "fault" && e.type !== "fault-end"
    );
    if (normalIncoming.length > 1) {
      mergePoints.set(nodeId, normalIncoming.map((e) => e.source));
    }
  });

  // Find the merge point for a branching node
  function findMergePointForBranches(branchTargets: string[]): string | undefined {
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

  // Calculate the depth (height in rows) of a branch until merge point or termination
  function calculateBranchDepth(
    startId: string,
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

    // For branching nodes, include all their branches' depth
    const nodeType = node.type;
    if (nodeType === "DECISION" || nodeType === "WAIT") {
      const branchTargets = outs.map((e) => e.target);
      const merge = findMergePointForBranches(branchTargets);
      
      let maxBranchDepth = 0;
      outs.forEach((e) => {
        const depth = calculateBranchDepth(e.target, merge, new Set(visited));
        maxBranchDepth = Math.max(maxBranchDepth, depth);
      });
      
      // After branches, continue from merge point
      const afterMerge = merge ? calculateBranchDepth(merge, stopAt, new Set(visited)) : 0;
      return 1 + maxBranchDepth + afterMerge;
    }

    if (nodeType === "LOOP") {
      const forEachEdge = outs.find((e) => e.type === "loop-next");
      const afterLastEdge = outs.find((e) => e.type === "loop-end");
      
      const loopBodyDepth = forEachEdge 
        ? calculateBranchDepth(forEachEdge.target, startId, new Set(visited)) 
        : 0;
      const afterLoopDepth = afterLastEdge 
        ? calculateBranchDepth(afterLastEdge.target, stopAt, new Set(visited)) 
        : 0;
      
      return 1 + Math.max(loopBodyDepth, 1) + afterLoopDepth;
    }

    // Linear node
    return 1 + calculateBranchDepth(outs[0].target, stopAt, visited);
  }

  // Calculate the width of a subtree (for horizontal positioning)
  function calculateSubtreeWidth(
    startId: string,
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
      const merge = findMergePointForBranches(branchTargets);
      
      // Total width is sum of all branch widths
      let totalWidth = 0;
      outs.forEach((e) => {
        const branchWidth = calculateSubtreeWidth(e.target, merge, new Set(visited));
        totalWidth += Math.max(branchWidth, 1);
      });
      
      // Width after merge
      const afterMergeWidth = merge ? calculateSubtreeWidth(merge, stopAt, new Set(visited)) : 0;
      
      return Math.max(totalWidth, afterMergeWidth, 1);
    }

    if (nodeType === "LOOP") {
      const forEachEdge = outs.find((e) => e.type === "loop-next");
      const afterLastEdge = outs.find((e) => e.type === "loop-end");
      
      const loopBodyWidth = forEachEdge 
        ? calculateSubtreeWidth(forEachEdge.target, startId, new Set(visited)) 
        : 1;
      const afterLoopWidth = afterLastEdge 
        ? calculateSubtreeWidth(afterLastEdge.target, stopAt, new Set(visited)) 
        : 1;
      
      // Loop needs at least 2 columns: loop body + main path
      return Math.max(loopBodyWidth + 1, afterLoopWidth, 2);
    }

    // Linear node
    return calculateSubtreeWidth(outs[0].target, stopAt, visited);
  }

  // Position nodes using recursive tree layout
  const positions = new Map<string, { x: number; y: number }>();
  const ROW_HEIGHT = NODE_HEIGHT + GRID_V_GAP;
  const COL_WIDTH = NODE_WIDTH + GRID_H_GAP;

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

    // Handle fault paths - position to the right
    faultOuts.forEach((edge, i) => {
      if (!visited.has(edge.target)) {
        layoutNode(edge.target, centerX + COL_WIDTH * (2 + i), row, undefined, new Set(visited));
      }
    });

    if (outs.length === 0) return;

    const nodeType = node.type;

    if (nodeType === "DECISION" || nodeType === "WAIT") {
      const branchTargets = outs.map((e) => e.target);
      const mergePoint = findMergePointForBranches(branchTargets);

      // Sort branches: named outcomes left, default right
      const sortedOuts = [...outs].sort((a, b) => {
        const aIsDefault = a.label?.toLowerCase().includes("default") || a.label === "Other";
        const bIsDefault = b.label?.toLowerCase().includes("default") || b.label === "Other";
        if (aIsDefault && !bIsDefault) return 1;
        if (!aIsDefault && bIsDefault) return -1;
        return 0;
      });

      // Calculate widths of each branch
      const branchWidths = sortedOuts.map((e) => 
        Math.max(calculateSubtreeWidth(e.target, mergePoint, new Set(visited)), 1)
      );
      const totalWidth = branchWidths.reduce((a, b) => a + b, 0);

      // Position branches centered around parent's X
      let currentX = centerX - (totalWidth * COL_WIDTH) / 2 + COL_WIDTH / 2;
      let maxBranchDepth = 0;

      sortedOuts.forEach((edge, idx) => {
        const branchWidth = branchWidths[idx];
        const branchCenterX = currentX + (branchWidth - 1) * COL_WIDTH / 2;
        
        if (!visited.has(edge.target)) {
          layoutNode(edge.target, branchCenterX, row + 1, mergePoint, new Set(visited));
        }

        const branchDepth = calculateBranchDepth(edge.target, mergePoint, new Set(visited));
        maxBranchDepth = Math.max(maxBranchDepth, branchDepth);
        
        currentX += branchWidth * COL_WIDTH;
      });

      // Layout after merge point
      if (mergePoint && !visited.has(mergePoint)) {
        layoutNode(mergePoint, centerX, row + 1 + maxBranchDepth, stopAt, visited);
      }

    } else if (nodeType === "LOOP") {
      const forEachEdge = outs.find((e) => e.type === "loop-next");
      const afterLastEdge = outs.find((e) => e.type === "loop-end");

      const loopBodyWidth = forEachEdge 
        ? calculateSubtreeWidth(forEachEdge.target, nodeId, new Set(visited))
        : 1;
      
      // Position "For Each" branch to the left
      if (forEachEdge && !visited.has(forEachEdge.target)) {
        const loopBodyX = centerX - COL_WIDTH * (loopBodyWidth / 2 + 0.5);
        layoutNode(forEachEdge.target, loopBodyX, row + 1, nodeId, new Set(visited));
      }

      // Calculate loop body depth for "After Last" positioning
      const loopBodyDepth = forEachEdge 
        ? calculateBranchDepth(forEachEdge.target, nodeId, new Set(visited))
        : 1;

      // Position "After Last" below the loop
      if (afterLastEdge && !visited.has(afterLastEdge.target)) {
        layoutNode(afterLastEdge.target, centerX, row + 1 + loopBodyDepth, stopAt, visited);
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
  layoutNode("START_NODE", START_X, 0);

  // Handle any unvisited nodes (shouldn't happen normally)
  let maxRow = 0;
  positions.forEach((p) => {
    maxRow = Math.max(maxRow, Math.floor((p.y - START_Y) / ROW_HEIGHT));
  });

  nodes.forEach((n) => {
    if (!positions.has(n.id)) {
      maxRow++;
      positions.set(n.id, { x: START_X + 400, y: START_Y + maxRow * ROW_HEIGHT });
    }
  });

  return nodes.map((n) => {
    const pos = positions.get(n.id) || { x: START_X, y: START_Y };
    return { ...n, x: pos.x - n.width / 2, y: pos.y };
  });
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [xmlInput, setXmlInput] = useState(DEMO_XML);
  const [parsedData, setParsedData] = useState<ParsedFlow>({
    nodes: [],
    edges: [],
    metadata: {},
  });
  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [autoLayoutEnabled, setAutoLayoutEnabled] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flowFileName, setFlowFileName] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // VS Code message handler
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.command === "loadXml") {
        setXmlInput(e.data.payload);
        if (e.data.fileName) setFlowFileName(e.data.fileName);
        setSelectedNode(null);
        setPan({ x: 0, y: 0 });
        setScale(0.9);
      }
    };
    window.addEventListener("message", handler);
    if (vscode) vscode.postMessage({ command: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  // Parse XML when input changes
  useEffect(() => {
    try {
      const { nodes, edges, metadata } = parseFlowXML(xmlInput);
      if (autoLayoutEnabled && nodes.length > 0) {
        setParsedData({ nodes: autoLayout(nodes, edges), edges, metadata });
      } else {
        setParsedData({ nodes, edges, metadata });
      }
    } catch (err) {
      console.error("Parse error:", err);
    }
  }, [xmlInput, autoLayoutEnabled]);

  // Canvas interactions - use document-level events for reliable dragging
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".flow-node")) return;
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setPan((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Scroll to zoom (no modifier needed)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(0.2, s + delta), 2));
  };

  // Render edges - Salesforce-style connectors
  // Key insight: Salesforce draws branch connectors with a horizontal "branch line"
  // that spreads from the parent, with each child's connector dropping down from it
  // Also draws "merge lines" where multiple branches converge to the same node
  const renderEdges = () => {
    // Group edges by source and target to detect branching and merging
    const edgesBySource = new Map<string, FlowEdge[]>();
    const edgesByTarget = new Map<string, FlowEdge[]>();
    parsedData.edges.forEach((edge) => {
      const sourceList = edgesBySource.get(edge.source) || [];
      sourceList.push(edge);
      edgesBySource.set(edge.source, sourceList);
      
      const targetList = edgesByTarget.get(edge.target) || [];
      targetList.push(edge);
      edgesByTarget.set(edge.target, targetList);
    });

    // Identify which sources are branch nodes (DECISION, WAIT, LOOP with multiple outputs)
    const branchNodes = new Set<string>();
    parsedData.nodes.forEach((n) => {
      if (n.type === "DECISION" || n.type === "WAIT" || n.type === "LOOP") {
        branchNodes.add(n.id);
      }
    });

    // Identify merge points (nodes with multiple incoming non-fault edges)
    const mergeNodes = new Set<string>();
    edgesByTarget.forEach((edges, targetId) => {
      const normalEdges = edges.filter(e => e.type !== "fault" && e.type !== "fault-end");
      if (normalEdges.length > 1) {
        mergeNodes.add(targetId);
      }
    });

    const rendered: JSX.Element[] = [];
    const handledEdges = new Set<string>(); // Track edges already rendered

    // First, render branch "spread lines" for decision/wait nodes
    branchNodes.forEach((nodeId) => {
      const srcNode = parsedData.nodes.find((n) => n.id === nodeId);
      if (!srcNode) return;

      const edges = edgesBySource.get(nodeId) || [];
      // Filter to only normal branch edges (not fault)
      const branchEdges = edges.filter(
        (e) =>
          e.type !== "fault" &&
          e.type !== "fault-end" &&
          e.type !== "loop-end"
      );

      if (branchEdges.length > 1 || srcNode.type === "LOOP") {
        // This is a branching point - draw the horizontal branch line
        const srcCenterX = srcNode.x + srcNode.width / 2;
        const srcBottomY = srcNode.y + srcNode.height;

        // Find all target positions
        const targetPositions = branchEdges
          .map((e) => {
            const tgt = parsedData.nodes.find((n) => n.id === e.target);
            return tgt ? { edge: e, x: tgt.x + tgt.width / 2, y: tgt.y } : null;
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        if (targetPositions.length > 0) {
          // Calculate branch line Y position (fixed distance from source)
          const branchLineY = srcBottomY + 35;

          // Find leftmost and rightmost branch targets
          const xs = targetPositions.map((t) => t.x);
          const minX = Math.min(...xs, srcCenterX);
          const maxX = Math.max(...xs, srcCenterX);

          // Draw horizontal branch line
          rendered.push(
            <path
              key={`branch-line-${nodeId}`}
              d={`M ${minX} ${branchLineY} L ${maxX} ${branchLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw vertical connector from source to branch line
          rendered.push(
            <path
              key={`branch-stem-${nodeId}`}
              d={`M ${srcCenterX} ${srcBottomY} L ${srcCenterX} ${branchLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw vertical connectors from branch line to each target
          targetPositions.forEach(({ edge, x, y }) => {
            handledEdges.add(edge.id);
            rendered.push(
              <g key={`branch-drop-${edge.id}`}>
                <path
                  d={`M ${x} ${branchLineY} L ${x} ${y}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  markerEnd="url(#arrow)"
                />
                {edge.label && (
                  <foreignObject
                    x={x - 60}
                    y={branchLineY - 22}
                    width={120}
                    height={24}
                    style={{ overflow: "visible" }}
                  >
                    <div className="text-[10px] px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded-full text-center truncate shadow-sm max-w-[110px] mx-auto">
                      {edge.label}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          });
        }
      }
    });

    // Render merge lines for nodes with multiple incoming edges FROM THE SAME DECISION
    // This is the "diamond" pattern where branches from one decision converge
    mergeNodes.forEach((targetId) => {
      const tgtNode = parsedData.nodes.find((n) => n.id === targetId);
      if (!tgtNode) return;

      const incomingEdges = (edgesByTarget.get(targetId) || []).filter(
        (e) => e.type !== "fault" && e.type !== "fault-end" && !handledEdges.has(e.id)
      );

      // Only draw merge lines if we have 2+ unhandled incoming edges
      // AND they come from different nodes (not already part of branch rendering)
      if (incomingEdges.length > 1) {
        const tgtCenterX = tgtNode.x + tgtNode.width / 2;
        const tgtTopY = tgtNode.y;

        // Get source positions for unhandled edges
        const sourcePositions = incomingEdges
          .map((e) => {
            const src = parsedData.nodes.find((n) => n.id === e.source);
            return src ? { edge: e, x: src.x + src.width / 2, y: src.y + src.height } : null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        // Check if all sources are at the same Y level (siblings from same parent)
        const sourceYs = new Set(sourcePositions.map(s => Math.round(s.y / 10) * 10)); // Round to reduce precision issues
        const allSameLevel = sourceYs.size === 1;

        if (sourcePositions.length > 1 && allSameLevel) {
          // Calculate merge line Y position (fixed distance above target)
          const mergeLineY = tgtTopY - 35;

          // Find leftmost and rightmost sources
          const xs = sourcePositions.map((s) => s.x);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);

          // Draw horizontal merge line
          rendered.push(
            <path
              key={`merge-line-${targetId}`}
              d={`M ${minX} ${mergeLineY} L ${maxX} ${mergeLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw vertical connector from merge line to target
          rendered.push(
            <path
              key={`merge-stem-${targetId}`}
              d={`M ${tgtCenterX} ${mergeLineY} L ${tgtCenterX} ${tgtTopY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />
          );

          // Draw connectors from each source to the merge line
          sourcePositions.forEach(({ edge, x, y }) => {
            handledEdges.add(edge.id);
            rendered.push(
              <path
                key={`merge-drop-${edge.id}`}
                d={`M ${x} ${y} L ${x} ${mergeLineY}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
              />
            );
          });
        }
      }
    });

    // Now render all other edges (non-branch, non-merge connectors)
    parsedData.edges.forEach((edge) => {
      // Skip edges already handled by branch or merge rendering
      if (handledEdges.has(edge.id)) {
        return;
      }

      const src = parsedData.nodes.find((n) => n.id === edge.source);
      const tgt = parsedData.nodes.find((n) => n.id === edge.target);
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
      const isLoopNext = edge.type === "loop-next";
      const isLoopEnd = edge.type === "loop-end";

      // Skip branch edges that weren't captured (fallback check)
      const srcEdges = edgesBySource.get(edge.source) || [];
      const isBranchChild =
        branchNodes.has(edge.source) &&
        !isFault &&
        !isFaultEnd &&
        !isLoopEnd &&
        srcEdges.filter((e) => e.type !== "fault" && e.type !== "fault-end" && e.type !== "loop-end").length > 1;
      
      // For loop nodes, loop-next is handled as a branch
      const isLoopBranch = 
        src.type === "LOOP" && isLoopNext;

      if (isBranchChild || isLoopBranch) {
        return; // Already rendered as part of branch
      }

      // Check if this is a loop-back connector (target is above source)
      const isLoopBack =
        !isFault &&
        !isFaultEnd &&
        !isLoopNext &&
        !isLoopEnd &&
        tgtTopY < srcBottomY;
      
      let path: string;
      const showAsRed = isFault || isFaultEnd;

      const FAULT_HORIZONTAL_OFFSET = 60;

      if (isFaultEnd) {
        // Horizontal path for fault-end connectors
        path = `M ${srcRightX} ${srcCenterY} L ${tgtLeftX} ${tgtCenterY}`;
      } else if (isFault) {
        // Fault connectors: exit from right side
        const horizontalEndX = srcRightX + FAULT_HORIZONTAL_OFFSET;
        const cornerRadius = 10;

        if (Math.abs(tgtCenterY - srcCenterY) < 20) {
          path = `M ${srcRightX} ${srcCenterY} L ${tgtLeftX} ${tgtCenterY}`;
        } else if (tgtCenterY > srcCenterY) {
          path = `M ${srcRightX} ${srcCenterY} 
                  L ${horizontalEndX - cornerRadius} ${srcCenterY}
                  Q ${horizontalEndX} ${srcCenterY}, ${horizontalEndX} ${srcCenterY + cornerRadius}
                  L ${horizontalEndX} ${tgtCenterY - cornerRadius}
                  Q ${horizontalEndX} ${tgtCenterY}, ${horizontalEndX + cornerRadius} ${tgtCenterY}
                  L ${tgtLeftX} ${tgtCenterY}`;
        } else {
          path = `M ${srcRightX} ${srcCenterY} 
                  L ${horizontalEndX - cornerRadius} ${srcCenterY}
                  Q ${horizontalEndX} ${srcCenterY}, ${horizontalEndX} ${srcCenterY - cornerRadius}
                  L ${horizontalEndX} ${tgtCenterY + cornerRadius}
                  Q ${horizontalEndX} ${tgtCenterY}, ${horizontalEndX + cornerRadius} ${tgtCenterY}
                  L ${tgtLeftX} ${tgtCenterY}`;
        }
      } else if (isLoopBack) {
        // Loop-back connector: go left and up
        const offsetX = Math.min(50, Math.abs(srcCenterX - tgtCenterX) / 2 + 30);
        const leftX = Math.min(srcCenterX, tgtCenterX) - offsetX;
        const cornerRadius = 15;
        path = `M ${srcCenterX} ${srcBottomY} 
                L ${srcCenterX} ${srcBottomY + 20} 
                Q ${srcCenterX} ${srcBottomY + 20 + cornerRadius}, ${srcCenterX - cornerRadius} ${srcBottomY + 20 + cornerRadius}
                L ${leftX + cornerRadius} ${srcBottomY + 20 + cornerRadius}
                Q ${leftX} ${srcBottomY + 20 + cornerRadius}, ${leftX} ${srcBottomY + 20}
                L ${leftX} ${tgtTopY + 20}
                Q ${leftX} ${tgtTopY - cornerRadius}, ${leftX + cornerRadius} ${tgtTopY - cornerRadius}
                L ${tgtCenterX - cornerRadius} ${tgtTopY - cornerRadius}
                Q ${tgtCenterX} ${tgtTopY - cornerRadius}, ${tgtCenterX} ${tgtTopY}`;
      } else if (Math.abs(tgtCenterX - srcCenterX) < 5) {
        // Straight vertical line
        path = `M ${srcCenterX} ${srcBottomY} L ${tgtCenterX} ${tgtTopY}`;
      } else {
        // Orthogonal routing with rounded corners
        const verticalMid = srcBottomY + (tgtTopY - srcBottomY) / 2;
        const cornerRadius = 12;
        const dx = tgtCenterX - srcCenterX;
        const sign = dx > 0 ? 1 : -1;

        if (Math.abs(tgtTopY - srcBottomY) < 40) {
          path = `M ${srcCenterX} ${srcBottomY} 
                  L ${srcCenterX} ${srcBottomY + 15}
                  Q ${srcCenterX} ${srcBottomY + 25}, ${srcCenterX + sign * 10} ${srcBottomY + 25}
                  L ${tgtCenterX - sign * 10} ${srcBottomY + 25}
                  Q ${tgtCenterX} ${srcBottomY + 25}, ${tgtCenterX} ${srcBottomY + 35}
                  L ${tgtCenterX} ${tgtTopY}`;
        } else {
          path = `M ${srcCenterX} ${srcBottomY} 
                  L ${srcCenterX} ${verticalMid - cornerRadius}
                  Q ${srcCenterX} ${verticalMid}, ${srcCenterX + sign * cornerRadius} ${verticalMid}
                  L ${tgtCenterX - sign * cornerRadius} ${verticalMid}
                  Q ${tgtCenterX} ${verticalMid}, ${tgtCenterX} ${verticalMid + cornerRadius}
                  L ${tgtCenterX} ${tgtTopY}`;
        }
      }

      // Calculate label position
      let labelX = (srcCenterX + tgtCenterX) / 2;
      let labelY = srcBottomY + 20;

      if (isFault || isFaultEnd) {
        labelX = srcRightX + 35;
        labelY = srcCenterY - 18;
      } else if (isLoopBack) {
        const leftX = Math.min(srcCenterX, tgtCenterX) - 50;
        labelX = leftX - 30;
        labelY = (srcBottomY + tgtTopY) / 2;
      } else if (isLoopEnd) {
        // After Last label - position below the loop node
        labelX = srcCenterX;
        labelY = srcBottomY + 18;
      }

      rendered.push(
        <g key={edge.id}>
          <path
            d={path}
            fill="none"
            stroke={showAsRed ? "#ef4444" : "#94a3b8"}
            strokeWidth={2}
            strokeDasharray={showAsRed ? "6,4" : undefined}
            markerEnd={showAsRed ? "url(#arrow-red)" : "url(#arrow)"}
          />
          {edge.label && (
            <foreignObject
              x={labelX - 50}
              y={labelY - 8}
              width={100}
              height={30}
              style={{ overflow: "visible" }}
            >
              <div
                className={`text-[10px] px-2 py-0.5 rounded-full text-center truncate border shadow-sm mx-auto
                ${showAsRed ? "bg-red-500 text-white border-red-600 font-medium" : "bg-white text-slate-600 border-slate-200 max-w-[90px]"}`}
              >
                {edge.label}
              </div>
            </foreignObject>
          )}
        </g>
      );
    });

    return rendered;
  };

  const title =
    parsedData.metadata.label ||
    flowFileName?.replace(".flow-meta.xml", "") ||
    "Flow Visualizer";

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans text-sm">
      {/* SIDEBAR */}
      <div
        className={`bg-white border-r border-slate-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
        style={{ width: sidebarOpen ? 320 : 0 }}
      >
        {/* Header */}
        <div className="h-14 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center px-4 flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
            <FileCode className="text-white w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate text-sm">
              {title}
            </div>
            {parsedData.metadata.apiVersion && (
              <div className="text-[10px] text-blue-200">
                API v{parsedData.metadata.apiVersion}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-4 text-xs flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-medium text-slate-700">
              {parsedData.nodes.length}
            </span>
            <span className="text-slate-500">nodes</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-medium text-slate-700">
              {parsedData.edges.length}
            </span>
            <span className="text-slate-500">connections</span>
          </span>
        </div>

        {/* Details Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedNode ? (
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      NODE_CONFIG[selectedNode.type]?.color || "#64748b",
                  }}
                >
                  {React.createElement(
                    NODE_CONFIG[selectedNode.type]?.icon || Circle,
                    { size: 20, className: "text-white" }
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 leading-tight">
                    {selectedNode.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {NODE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    API Name
                  </div>
                  <div className="font-mono text-xs bg-slate-100 px-2 py-1.5 rounded border border-slate-200 break-all">
                    {selectedNode.id}
                  </div>
                </div>

                {typeof selectedNode.data.object === "string" &&
                  selectedNode.data.object && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Object
                      </div>
                      <div className="text-xs bg-slate-100 px-2 py-1.5 rounded border border-slate-200">
                        {selectedNode.data.object}
                      </div>
                    </div>
                  )}

                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Connections
                  </div>
                  <div className="space-y-1">
                    {parsedData.edges
                      .filter((e) => e.source === selectedNode.id)
                      .map((e) => (
                        <div
                          key={e.id}
                          className={`text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border
                        ${e.type === "fault" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                        >
                          <ChevronRight size={12} />
                          <span className="truncate flex-1">{e.target}</span>
                          {e.label && (
                            <span className="text-[10px] text-slate-400">
                              ({e.label})
                            </span>
                          )}
                        </div>
                      ))}
                    {parsedData.edges
                      .filter((e) => e.target === selectedNode.id)
                      .map((e) => (
                        <div
                          key={e.id}
                          className="text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border bg-slate-50 text-slate-600 border-slate-200"
                        >
                          <ChevronLeft size={12} />
                          <span className="truncate">{e.source}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {typeof selectedNode.data.xmlElement === "string" &&
                  selectedNode.data.xmlElement && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        XML
                      </div>
                      <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-40 font-mono">
                        {selectedNode.data.xmlElement.slice(0, 600)}
                        {selectedNode.data.xmlElement.length > 600 && "..."}
                      </pre>
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
              <Info className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-center text-xs">
                Select a node to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SIDEBAR TOGGLE */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 rounded-r-lg shadow-md p-1.5 hover:bg-slate-50 transition-all"
        style={{ left: sidebarOpen ? 308 : 0 }}
      >
        {sidebarOpen ? (
          <ChevronLeftCircle size={20} className="text-slate-500" />
        ) : (
          <ChevronRightCircle size={20} className="text-slate-500" />
        )}
      </button>

      {/* CANVAS AREA */}
      <div className="flex-1 relative overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white rounded-xl shadow-lg border border-slate-200 px-2 py-1.5 flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.15, 2))}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn size={16} className="text-slate-600" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.2))}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut size={16} className="text-slate-600" />
          </button>
          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setScale(0.9);
            }}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Reset"
          >
            <Home size={16} className="text-slate-600" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <button
            onClick={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors
              ${autoLayoutEnabled ? "bg-blue-100 text-blue-700" : "hover:bg-slate-100 text-slate-600"}`}
          >
            <Layout size={14} />
            Auto-Layout
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute top-4 right-4 z-10 bg-white px-3 py-1.5 rounded-lg shadow border border-slate-200 text-xs font-medium text-slate-600">
          {Math.round(scale * 100)}%
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="w-full h-full cursor-grab select-none"
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          style={{
            backgroundImage:
              "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
              width: "4000px",
              height: "4000px",
            }}
          >
            {/* SVG for edges */}
            <svg className="absolute top-0 left-0 w-1 h-1 overflow-visible pointer-events-none">
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-red"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                </marker>
              </defs>
              {renderEdges()}
            </svg>

            {/* Nodes */}
            {parsedData.nodes.map((node) => {
              const config = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;
              const isSelected = selectedNode?.id === node.id;

              // Special rendering for END nodes - simple red circle
              if (node.type === "END") {
                const isFaultPath = node.data.isFaultPath === true;

                // For fault-path END nodes, position horizontally
                if (isFaultPath) {
                  return (
                    <div
                      key={node.id}
                      className="flow-node absolute flex flex-row items-center"
                      style={{ left: node.x, top: node.y, width: node.width }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                    >
                      {/* End circle */}
                      <div
                        className={`
                        w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
                        shadow-md transition-all
                        ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
                      `}
                      >
                        <Circle size={16} className="text-white" fill="white" />
                      </div>

                      {/* Label */}
                      <div className="text-xs font-medium text-slate-600 ml-2">
                        End
                      </div>
                    </div>
                  );
                }

                // Normal END node (vertical connection from above)
                return (
                  <div
                    key={node.id}
                    className="flow-node absolute flex flex-col items-center"
                    style={{ left: node.x, top: node.y, width: node.width }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                  >
                    {/* Top connector dot */}
                    <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow mb-2"></div>

                    {/* End circle */}
                    <div
                      className={`
                      w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
                      shadow-md transition-all
                      ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
                    `}
                    >
                      <Circle size={16} className="text-white" fill="white" />
                    </div>

                    {/* Label */}
                    <div className="text-xs font-medium text-slate-600 mt-1.5">
                      End
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  className="flow-node absolute"
                  style={{ left: node.x, top: node.y, width: node.width }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                >
                  {/* Top connector dot */}
                  {node.type !== "START" && (
                    <div className="flex justify-center -mb-1.5 relative z-10">
                      <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow"></div>
                    </div>
                  )}

                  {/* Node card */}
                  <div
                    className={`
                    rounded-xl border-2 shadow-md cursor-pointer overflow-hidden transition-all
                    ${isSelected ? "border-blue-500 shadow-lg ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300 hover:shadow-lg"}
                    bg-white
                  `}
                  >
                    <div className="flex items-stretch">
                      {/* Icon */}
                      <div
                        className="w-10 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      >
                        {React.createElement(config.icon, {
                          size: 16,
                          className: "text-white",
                        })}
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-3 py-2 min-w-0">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                          {config.label}
                        </div>
                        <div
                          className="text-sm font-semibold text-slate-800 truncate"
                          title={node.label}
                        >
                          {node.label}
                        </div>
                        {node.type === "START" &&
                          typeof node.data.object === "string" &&
                          node.data.object && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Object: {node.data.object}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom connector dot */}
                  <div className="flex justify-center -mt-1.5 relative z-10">
                    <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
