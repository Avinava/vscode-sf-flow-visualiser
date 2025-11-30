import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Layout,
  Info,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronLeftCircle,
  ChevronRightCircle,
  Circle,
} from "lucide-react";

// Import from modular structure
import { FlowNode, ParsedFlow } from "./types";
import { autoLayout } from "./layout";
import { parseFlowXML } from "./parser";
import { NODE_CONFIG } from "./constants";
import { EdgeRenderer, FlowNodeComponent, FlowHeader } from "./components";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode =
  typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

// Demo XML for testing
const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>57.0</apiVersion>
    <description>This flow automatically creates a task when a new Account is created. It checks for matching contacts and creates records accordingly.</description>
    <environments>Default</environments>
    <label>Sample Account Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>
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

  // Compute nodes that are targets of GoTo connectors and their counts
  const goToTargetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    parsedData.edges.forEach((edge) => {
      if (edge.isGoTo) {
        counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
      }
    });
    return counts;
  }, [parsedData.edges]);

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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden font-sans text-sm">
      {/* FLOW HEADER */}
      <FlowHeader metadata={parsedData.metadata} fileName={flowFileName} />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div
          className={`bg-white border-r border-slate-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
          style={{ width: sidebarOpen ? 320 : 0 }}
        >
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
                  {/* Icon with proper shape for DECISION/WAIT */}
                  {selectedNode.type === "DECISION" ||
                  selectedNode.type === "WAIT" ? (
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <div
                        className="w-8 h-8 flex items-center justify-center transform rotate-45 rounded-sm"
                        style={{
                          backgroundColor:
                            NODE_CONFIG[selectedNode.type]?.color || "#64748b",
                        }}
                      >
                        {React.createElement(
                          NODE_CONFIG[selectedNode.type]?.icon || Circle,
                          {
                            size: 16,
                            className: "text-white transform -rotate-45",
                          }
                        )}
                      </div>
                    </div>
                  ) : (
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
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 leading-tight">
                      {selectedNode.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {NODE_CONFIG[selectedNode.type]?.label ||
                        selectedNode.type}
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
          style={{ left: sidebarOpen ? 308 : 0, marginTop: "40px" }}
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white rounded-lg shadow border border-slate-200 px-2 py-1 flex items-center gap-1">
            <button
              onClick={() => setScale((s) => Math.min(s + 0.15, 2))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s - 0.15, 0.2))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={16} className="text-slate-600" />
            </button>
            <button
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setScale(0.9);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
              title="Reset"
            >
              <Home size={16} className="text-slate-600" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-0.5"></div>
            <button
              onClick={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors
                ${autoLayoutEnabled ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100 text-slate-600"}`}
            >
              <Layout size={14} />
              Auto-Layout
            </button>
          </div>

          {/* Zoom indicator */}
          <div className="absolute top-4 right-4 z-10 bg-white px-2.5 py-1 rounded-md shadow border border-slate-200 text-xs font-medium text-slate-500">
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
                "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              position: "relative",
              overflow: "hidden",
              backgroundColor: "#f8fafc",
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
              {/* SVG for edges - using EdgeRenderer component */}
              <EdgeRenderer nodes={parsedData.nodes} edges={parsedData.edges} />

              {/* Nodes - using FlowNodeComponent */}
              {parsedData.nodes.map((node) => (
                <FlowNodeComponent
                  key={node.id}
                  node={node}
                  isSelected={selectedNode?.id === node.id}
                  isGoToTarget={goToTargetCounts.has(node.id)}
                  incomingGoToCount={goToTargetCounts.get(node.id) || 0}
                  onSelect={setSelectedNode}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
