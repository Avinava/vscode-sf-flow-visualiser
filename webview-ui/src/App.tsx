import React, { useState, useEffect, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  FileCode,
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
import { EdgeRenderer } from "./components";

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
            {/* SVG for edges - using EdgeRenderer component */}
            <EdgeRenderer nodes={parsedData.nodes} edges={parsedData.edges} />

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
