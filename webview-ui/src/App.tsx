import React, { useState, useCallback } from "react";

// Import from modular structure
import { FlowHeader, EdgeRenderer, FlowNodeComponent } from "./components";
import { FlowCanvas, CanvasToolbar, Sidebar } from "./components";

// Import custom hooks
import {
  useVSCodeMessaging,
  useFlowParser,
  useCanvasInteraction,
  useNodeSelection,
} from "./hooks";

// ============================================================================
// MAIN APP COMPONENT
// Clean orchestration layer using custom hooks and modular components
// ============================================================================
const App: React.FC = () => {
  // Sidebar visibility state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Flow parsing and layout hook
  const {
    parsedData,
    autoLayoutEnabled,
    setAutoLayoutEnabled,
    loadFlow,
    goToTargetCounts,
    fileName,
  } = useFlowParser();

  // Canvas interaction hook
  const { state, onMouseDown, onWheel, zoomIn, zoomOut, resetView } =
    useCanvasInteraction();

  // Node selection hook
  const { selectedNode, selectNode, clearSelection } = useNodeSelection();

  // Handle new flow from VS Code - reset canvas state
  const handleLoadXml = useCallback(
    (xml: string, newFileName?: string) => {
      loadFlow(xml, newFileName);
      clearSelection();
      resetView();
    },
    [loadFlow, clearSelection, resetView]
  );

  // VS Code messaging hook - must be last to use other callbacks
  useVSCodeMessaging({ onLoadXml: handleLoadXml });

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden font-sans text-sm">
      {/* FLOW HEADER */}
      <FlowHeader metadata={parsedData.metadata} fileName={fileName} />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          selectedNode={selectedNode}
          nodeCount={parsedData.nodes.length}
          edgeCount={parsedData.edges.length}
          edges={parsedData.edges}
        />

        {/* CANVAS AREA */}
        <div className="flex-1 relative overflow-hidden">
          {/* Toolbar */}
          <CanvasToolbar
            scale={state.scale}
            autoLayoutEnabled={autoLayoutEnabled}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetView={resetView}
            onToggleAutoLayout={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
          />

          {/* Canvas */}
          <FlowCanvas
            pan={state.pan}
            scale={state.scale}
            onMouseDown={onMouseDown}
            onWheel={onWheel}
          >
            {/* SVG for edges */}
            <EdgeRenderer
              nodes={parsedData.nodes}
              edges={parsedData.edges}
              selectedNodeId={selectedNode?.id}
            />

            {/* Nodes */}
            {parsedData.nodes.map((node) => (
              <FlowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                isGoToTarget={goToTargetCounts.has(node.id)}
                incomingGoToCount={goToTargetCounts.get(node.id) || 0}
                onSelect={selectNode}
              />
            ))}
          </FlowCanvas>
        </div>
      </div>
    </div>
  );
};

export default App;
