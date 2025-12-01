import React, { useState, useCallback, useEffect, useMemo } from "react";

// Import from modular structure
import { FlowHeader, EdgeRenderer, FlowNodeComponent } from "./components";
import { FlowCanvas, CanvasToolbar, Sidebar, Minimap } from "./components";

// Import custom hooks
import {
  useVSCodeMessaging,
  useFlowParser,
  useCanvasInteraction,
  useNodeSelection,
  useEdgeSelection,
} from "./hooks";

// Import context
import {
  ThemeProvider,
  useTheme,
  CollapseProvider,
  useCollapse,
} from "./context";

// Import utilities
import { computeVisibility, getBranchingNodeIds } from "./utils/collapse";
import { calculateComplexity } from "./utils/complexity";
import { analyzeFlow, type FlowQualityMetrics } from "./utils/flow-scanner";

// Import types
import type { BoundingBox } from "./hooks/useCanvasInteraction";

// ============================================================================
// MAIN APP CONTENT
// Separated to use theme context
// ============================================================================
const AppContent: React.FC = () => {
  // Sidebar visibility state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoOpenViewerEnabled, setAutoOpenViewerEnabled] = useState(true);
  const [qualityMetrics, setQualityMetrics] = useState<FlowQualityMetrics | null>(null);

  // Theme context
  const { toggleTheme, isDark, toggleAnimation } = useTheme();

  // Collapse context for branching nodes
  const { collapsedNodes, isCollapsed, toggleCollapse } = useCollapse();

  // Flow parsing and layout hook
  const {
    parsedData,
    autoLayoutEnabled,
    setAutoLayoutEnabled,
    loadFlow,
    goToTargetCounts,
    fileName,
  } = useFlowParser();

  // Compute visibility based on collapsed nodes
  const { hiddenNodes, hiddenEdges } = useMemo(() => {
    if (collapsedNodes.size === 0) {
      return { hiddenNodes: new Set<string>(), hiddenEdges: new Set<string>() };
    }
    return computeVisibility(
      collapsedNodes,
      parsedData.nodes,
      parsedData.edges
    );
  }, [collapsedNodes, parsedData.nodes, parsedData.edges]);

  // Get list of branching node IDs
  const branchingNodeIds = useMemo(() => {
    return new Set(getBranchingNodeIds(parsedData.nodes));
  }, [parsedData.nodes]);

  // Calculate complexity metrics
  const complexityMetrics = useMemo(() => {
    if (parsedData.nodes.length === 0) return null;
    return calculateComplexity(parsedData.nodes, parsedData.edges);
  }, [parsedData.nodes, parsedData.edges]);

  // Analyze flow quality when XML changes
  useEffect(() => {
    if (parsedData.xmlContent) {
      analyzeFlow(parsedData.xmlContent).then(setQualityMetrics);
    } else {
      setQualityMetrics(null);
    }
  }, [parsedData.xmlContent]);

  // Filter visible nodes and edges
  const visibleNodes = useMemo(() => {
    return parsedData.nodes.filter((n) => !hiddenNodes.has(n.id));
  }, [parsedData.nodes, hiddenNodes]);

  const visibleEdges = useMemo(() => {
    return parsedData.edges.filter((e) => !hiddenEdges.has(e.id));
  }, [parsedData.edges, hiddenEdges]);

  // Calculate node bounds for fit-to-view (use visible nodes only)
  const getNodeBounds = useCallback((): BoundingBox | null => {
    if (visibleNodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of visibleNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [visibleNodes]);

  // Canvas interaction hook with theme toggle callback
  const {
    state,
    onMouseDown,
    onWheel,
    zoomIn,
    zoomOut,
    resetView,
    fitToView,
    setNodeBoundsGetter,
    setPan,
  } = useCanvasInteraction({
    onToggleTheme: toggleTheme,
    onToggleAnimation: toggleAnimation,
  });

  // Set up node bounds getter when nodes change
  useEffect(() => {
    setNodeBoundsGetter(getNodeBounds);
  }, [setNodeBoundsGetter, getNodeBounds]);

  // Node selection hook
  const { selectedNode, selectNode, clearSelection } = useNodeSelection();

  // Edge selection hook for path highlighting
  const { highlightedPath, selectEdge, clearEdgeSelection } = useEdgeSelection({
    nodes: parsedData.nodes,
    edges: parsedData.edges,
  });

  // Handle node selection - clear edge selection when selecting a node
  const handleSelectNode = useCallback(
    (node: typeof selectedNode) => {
      clearEdgeSelection();
      selectNode(node);
      // Auto-open sidebar when a node is selected
      if (node && !sidebarOpen) {
        setSidebarOpen(true);
      }
    },
    [clearEdgeSelection, selectNode, sidebarOpen]
  );

  // Handle edge click - clear node selection when selecting an edge
  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      clearSelection();
      selectEdge(edgeId);
    },
    [clearSelection, selectEdge]
  );

  // Handle new flow from VS Code - reset canvas state
  const handleLoadXml = useCallback(
    (xml: string, newFileName?: string) => {
      loadFlow(xml, newFileName);
      clearSelection();
      clearEdgeSelection();
      resetView();
    },
    [loadFlow, clearSelection, clearEdgeSelection, resetView]
  );

  // VS Code messaging hook - must be last to use other callbacks
  const { postMessage } = useVSCodeMessaging({
    onLoadXml: handleLoadXml,
    onAutoOpenPreference: setAutoOpenViewerEnabled,
  });

  const handleToggleAutoOpenPreference = useCallback(() => {
    postMessage({
      command: "setAutoOpenPreference",
      payload: { enabled: !autoOpenViewerEnabled },
    });
  }, [autoOpenViewerEnabled, postMessage]);

  return (
    <div
      className={`flex flex-col h-screen w-full overflow-hidden font-sans text-sm transition-colors duration-200
        ${isDark ? "bg-slate-900" : "bg-slate-100"}`}
    >
      {/* FLOW HEADER */}
      <FlowHeader
        metadata={parsedData.metadata}
        fileName={fileName}
        complexity={complexityMetrics}
      />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          selectedNode={selectedNode}
          nodes={parsedData.nodes}
          edges={parsedData.edges}
          qualityMetrics={qualityMetrics}
        />

        {/* CANVAS AREA */}
        <div className="flex-1 relative overflow-hidden">
          {/* Toolbar */}
          <CanvasToolbar
            scale={state.scale}
            autoLayoutEnabled={autoLayoutEnabled}
            autoOpenEnabled={autoOpenViewerEnabled}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetView={resetView}
            onFitToView={fitToView}
            onToggleAutoLayout={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
            onToggleAutoOpen={handleToggleAutoOpenPreference}
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
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNode?.id}
              highlightedPath={highlightedPath}
              onEdgeClick={handleEdgeClick}
            />

            {/* Nodes */}
            {visibleNodes.map((node) => (
              <FlowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                isGoToTarget={goToTargetCounts.has(node.id)}
                incomingGoToCount={goToTargetCounts.get(node.id) || 0}
                isCollapsed={isCollapsed(node.id)}
                isBranchingNode={branchingNodeIds.has(node.id)}
                onSelect={handleSelectNode}
                onToggleCollapse={toggleCollapse}
              />
            ))}
          </FlowCanvas>

          {/* Minimap */}
          <Minimap
            nodes={parsedData.nodes}
            pan={state.pan}
            scale={state.scale}
            onPanChange={setPan}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT WITH PROVIDERS
// ============================================================================
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <CollapseProvider>
        <AppContent />
      </CollapseProvider>
    </ThemeProvider>
  );
};

export default App;
