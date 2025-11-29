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
// CONSTANTS
// ============================================================================
const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const V_GAP = 80;
const H_GAP = 260;

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
// AUTO LAYOUT - Salesforce-style
// ============================================================================
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

  // Track positioned nodes
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  // Find convergence points (nodes with multiple incoming edges)
  const convergencePoints = new Set<string>();
  incoming.forEach((inEdges, nodeId) => {
    if (inEdges.length > 1) convergencePoints.add(nodeId);
  });

  // BFS layout starting from START_NODE
  const startX = 500;
  const startY = 60;

  interface QueueItem {
    id: string;
    row: number;
    col: number;
    fromLoop?: boolean;
    branchOffset?: number;
  }

  const queue: QueueItem[] = [{ id: "START_NODE", row: 0, col: 0 }];
  const rowUsage = new Map<number, Set<number>>(); // track columns used per row

  // Track loop bodies to position them specially
  const loopBodies = new Map<string, string[]>(); // loopId -> body node ids

  // First pass: identify loop bodies
  nodes.forEach((n) => {
    if (n.type === "LOOP") {
      const outs = outgoing.get(n.id) || [];
      const nextEdge = outs.find((e) => e.type === "loop-next");
      if (nextEdge) {
        // Find all nodes in loop body until we get back to loop or hit the "after last" path
        const bodyNodes: string[] = [];
        let current = nextEdge.target;
        const bodyVisited = new Set<string>();

        while (current && !bodyVisited.has(current)) {
          bodyVisited.add(current);
          const curNode = nodeMap.get(current);
          if (!curNode) break;

          // Check if this node connects back to the loop
          const curOuts = outgoing.get(current) || [];
          const connectsToLoop = curOuts.some((e) => e.target === n.id);

          bodyNodes.push(current);

          if (connectsToLoop) break;

          // Follow normal path
          const normalOut = curOuts.find(
            (e) => e.type === "normal" || e.type === "loop-next"
          );
          current = normalOut?.target || "";
        }

        loopBodies.set(n.id, bodyNodes);
      }
    }
  });

  while (queue.length > 0) {
    const { id, row, col } = queue.shift()!;

    if (visited.has(id)) continue;

    const node = nodeMap.get(id);
    if (!node) continue;

    visited.add(id);

    // Check if row/col is used
    if (!rowUsage.has(row)) rowUsage.set(row, new Set());
    let finalCol = col;
    while (rowUsage.get(row)!.has(finalCol)) {
      finalCol += 1;
    }
    rowUsage.get(row)!.add(finalCol);

    positions.set(id, {
      x: startX + finalCol * H_GAP,
      y: startY + row * (NODE_HEIGHT + V_GAP),
    });

    const outs = outgoing.get(id) || [];

    if (node.type === "LOOP") {
      // Handle loop specially
      const afterEdge = outs.find((e) => e.type === "loop-end");
      const bodyNodes = loopBodies.get(id) || [];

      // Position loop body to the left
      let bodyRow = row + 1;
      bodyNodes.forEach((bodyId) => {
        if (!visited.has(bodyId)) {
          queue.unshift({ id: bodyId, row: bodyRow, col: finalCol - 1 });
          bodyRow++;
        }
      });

      // After Last goes down from loop
      if (afterEdge && !visited.has(afterEdge.target)) {
        const afterRow = row + Math.max(bodyNodes.length + 1, 2);
        queue.push({ id: afterEdge.target, row: afterRow, col: finalCol });
      }
    } else if (node.type === "DECISION") {
      // Handle decision branches
      const sortedOuts = [...outs].sort((a, b) => {
        if (a.label === "Default" || a.type === "fault") return 1;
        if (b.label === "Default" || b.type === "fault") return -1;
        return 0;
      });

      let branchIndex = 0;

      sortedOuts.forEach((edge) => {
        if (visited.has(edge.target)) return;

        if (edge.type === "fault") {
          queue.push({ id: edge.target, row: row, col: finalCol + 2 });
        } else {
          // Spread branches: first goes left, rest go right
          const offset = branchIndex === 0 ? -1 : branchIndex;
          queue.push({ id: edge.target, row: row + 1, col: finalCol + offset });
          branchIndex++;
        }
      });
    } else {
      // Normal node - follow edges
      outs.forEach((edge) => {
        if (visited.has(edge.target)) return;

        if (edge.type === "fault") {
          queue.push({ id: edge.target, row: row, col: finalCol + 2 });
        } else if (edge.type === "fault-end") {
          // END node on a fault path - position to the right of the parent node
          queue.push({ id: edge.target, row: row, col: finalCol + 1 });
        } else {
          queue.push({ id: edge.target, row: row + 1, col: finalCol });
        }
      });
    }
  }

  // Handle any unvisited nodes
  let extraRow =
    Math.max(
      ...Array.from(positions.values()).map((p) => p.y / (NODE_HEIGHT + V_GAP))
    ) + 2;
  nodes.forEach((n) => {
    if (!positions.has(n.id)) {
      positions.set(n.id, {
        x: startX + 500,
        y: startY + extraRow * (NODE_HEIGHT + V_GAP),
      });
      extraRow++;
    }
  });

  // Adjust fault-path END nodes to align vertically with their source node
  edges.forEach((e) => {
    if (e.type === "fault-end") {
      const srcNode = nodeMap.get(e.source);
      const tgtPos = positions.get(e.target);
      if (srcNode && tgtPos) {
        const srcPos = positions.get(e.source);
        if (srcPos) {
          // Vertically center the END node with the source node
          // END circle is 40px tall, source node has height NODE_HEIGHT
          // We want: srcPos.y + NODE_HEIGHT/2 = tgtPos.y + 20 (center of END circle)
          tgtPos.y = srcPos.y + NODE_HEIGHT / 2 - 20;
        }
      }
    }
  });

  return nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
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

  // Render edges
  const renderEdges = () => {
    return parsedData.edges.map((edge) => {
      const src = parsedData.nodes.find((n) => n.id === edge.source);
      const tgt = parsedData.nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) return null;

      const x1 = src.x + src.width / 2;
      const y1 = src.y + src.height;
      const x2 = tgt.x + tgt.width / 2;
      const y2 = tgt.y;

      const isFault = edge.type === "fault";
      const isFaultEnd = edge.type === "fault-end";
      const isLoopBack =
        edge.source !== "START_NODE" &&
        parsedData.nodes.find((n) => n.id === edge.target)?.type === "LOOP" &&
        edge.type !== "loop-next" &&
        edge.type !== "loop-end";

      let path: string;

      if (isFaultEnd) {
        // Horizontal path to END node on fault path - straight line from right side of source to left side of END
        const srcRightX = src.x + src.width;
        const srcMidY = src.y + src.height / 2;
        // Target left edge - the END circle (40px wide)
        const tgtLeftX = tgt.x;
        // Path goes straight horizontally
        path = `M ${srcRightX} ${srcMidY} L ${tgtLeftX} ${srcMidY}`;
      } else if (isLoopBack) {
        // Loop back: go left and up
        const midX = Math.min(x1, x2) - 60;
        path = `M ${x1} ${y1} L ${x1} ${y1 + 20} L ${midX} ${y1 + 20} L ${midX} ${y2 - 20} L ${x2} ${y2 - 20} L ${x2} ${y2}`;
      } else if (Math.abs(x2 - x1) < 10) {
        // Straight down
        path = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else if (y2 < y1) {
        // Going up (unusual) - route around
        const midY = y1 + 30;
        path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
      } else {
        // Normal routing with rounded corners
        const midY = y1 + (y2 - y1) * 0.3;
        path = `M ${x1} ${y1} L ${x1} ${midY} Q ${x1} ${midY + 15}, ${x1 + (x2 > x1 ? 15 : -15)} ${midY + 15} L ${x2 + (x2 > x1 ? -15 : 15)} ${midY + 15} Q ${x2} ${midY + 15}, ${x2} ${midY + 30} L ${x2} ${y2}`;
      }

      const labelX = (x1 + x2) / 2;
      const labelY = y1 + 25;
      const showAsRed = isFault || isFaultEnd;

      return (
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
              x={labelX - 55}
              y={labelY - 4}
              width={110}
              height={30}
              style={{ overflow: "visible" }}
            >
              <div
                className={`text-[10px] px-2.5 py-1.5 rounded-full text-center truncate border shadow-sm
                ${showAsRed ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-slate-600 border-slate-200"}`}
              >
                {edge.label}
              </div>
            </foreignObject>
          )}
        </g>
      );
    });
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
