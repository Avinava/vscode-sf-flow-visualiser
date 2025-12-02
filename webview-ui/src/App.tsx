import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";

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
import {
  FlowNode,
} from "./types";
import { analyzeFlow, FlowQualityMetrics, FlowViolation } from "./utils/flow-scanner";

// Import types
import { BoundingBox } from "./hooks/useCanvasInteraction";

import { getVSCodeApi } from "./utils/vscodeApi";

// ... (keep existing imports)
import { toPng } from "html-to-image";

// ============================================================================
// MAIN APP CONTENT
// Separated to use theme context
// ============================================================================
const AppContent: React.FC = () => {
  // Sidebar visibility state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"details" | "quality">(
    "details"
  );
  const [autoOpenViewerEnabled, setAutoOpenViewerEnabled] = useState(true);
  const [qualityMetrics, setQualityMetrics] =
    useState<FlowQualityMetrics | null>(null);
  
  // Track when a new flow is loaded to trigger auto-center
  const shouldAutoCenter = useRef(false);

  // Get VS Code API
  const vscode = useMemo(() => getVSCodeApi(), []);

  // Scan state - persisted, defaults to true
  const [scanEnabled, setScanEnabled] = useState<boolean>(() => {
    const state = vscode?.getState() as { scanEnabled?: boolean } | undefined;
    return state?.scanEnabled ?? true;
  });

  const toggleScan = useCallback(() => {
    setScanEnabled((prev) => {
      const newValue = !prev;
      if (vscode) {
        const currentState = vscode.getState() || {};
        vscode.setState({ ...currentState, scanEnabled: newValue });
        vscode.postMessage({
          command: "saveState",
          payload: { key: "scanEnabled", value: newValue },
        });
      }
      return newValue;
    });
  }, [vscode]);

  // Listen for state restoration from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { command, payload } = event.data;
      if (command === "restoreState" && payload) {
        if (payload.scanEnabled !== undefined) {
          setScanEnabled(payload.scanEnabled);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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
    faultLanes,
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

  // Analyze flow quality when XML changes or scan is toggled
  useEffect(() => {
    let isMounted = true;

    if (parsedData.xmlContent && scanEnabled) {
      analyzeFlow(parsedData.xmlContent).then((metrics) => {
        if (isMounted) {
          setQualityMetrics(metrics);
        }
      });
    } else {
      setQualityMetrics(null);
    }

    return () => {
      isMounted = false;
    };
  }, [parsedData.xmlContent, scanEnabled]);

  // Create mapping of violations by element name for node badges
  const violationsByElement = useMemo(() => {
    if (!qualityMetrics)
      return new Map<
        string,
        Array<{
          severity: "error" | "warning" | "note";
          rule: string;
          message: string;
        }>
      >();

    const map = new Map<
      string,
      Array<{
        severity: "error" | "warning" | "note";
        rule: string;
        message: string;
      }>
    >();
    qualityMetrics.violations.forEach((violation: FlowViolation) => {
      if (violation.elementName) {
        if (!map.has(violation.elementName)) {
          map.set(violation.elementName, []);
        }
        map.get(violation.elementName)!.push(violation);
      }
    });
    return map;
  }, [qualityMetrics]);

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

  // Get Start Node for centering
  const getStartNode = useCallback((): FlowNode | null => {
    return visibleNodes.find(n => n.type === 'START') || null;
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
    startNodeGetter: getStartNode,
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

  // Handle edge click - clear node selection when selecting an edge
  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      clearSelection();
      selectEdge(edgeId);
    },
    [clearSelection, selectEdge]
  );

  // Handle new flow from VS Code - mark for auto-center
  const handleLoadXml = useCallback(
    (xml: string, newFileName?: string) => {
      loadFlow(xml, newFileName);
      clearSelection();
      clearEdgeSelection();
      // Mark that we should auto-center when nodes are loaded
      shouldAutoCenter.current = true;
    },
    [loadFlow, clearSelection, clearEdgeSelection]
  );

  // Auto-center flow when nodes are first loaded (same as home button)
  useEffect(() => {
    if (shouldAutoCenter.current && visibleNodes.length > 0) {
      // Use the same function as home button for consistent behavior
      resetView();
      shouldAutoCenter.current = false;
    }
  }, [visibleNodes, resetView]);

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

  const handleExportImage = useCallback(async () => {
    // Use the inner content div which contains the nodes/edges
    const flowContent = document.getElementById("flow-canvas-content");

    if (flowContent && visibleNodes.length > 0) {
      try {
        // Calculate bounds of all visible nodes
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        visibleNodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x + node.width);
          maxY = Math.max(maxY, node.y + node.height);
        });

        // Add padding
        const padding = 100;
        const width = maxX - minX + padding * 2 + 200; // Add extra buffer for right-side clipping
        const height = maxY - minY + padding * 2;

        // Capture with specific dimensions and transform reset
        const dataUrl = await toPng(flowContent, {
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          width: width,
          height: height,
          style: {
            transform: `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`,
            transformOrigin: "0 0",
            width: `${width}px`,
            height: `${height}px`,
            // Override any fixed dimensions from the container
            maxWidth: "none",
            maxHeight: "none",
          },
          pixelRatio: 2,
        });

        postMessage({
          command: "saveImage",
          payload: {
            dataUrl,
            fileName: `${fileName.replace(".flow-meta.xml", "")}.png`,
          },
        });
      } catch (error) {
        console.error("Failed to export image:", error);
        postMessage({
          command: "alert",
          text: "Failed to export image. See console for details.",
        });
      }
    } else {
      postMessage({
        command: "alert",
        text: "No flow content to export.",
      });
    }
  }, [isDark, fileName, postMessage, visibleNodes]);



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
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        />

        {/* CANVAS AREA */}
        <div className="flex-1 relative overflow-hidden">
          {/* Toolbar */}
          <CanvasToolbar
            scale={state.scale}
            autoLayoutEnabled={autoLayoutEnabled}
            autoOpenEnabled={autoOpenViewerEnabled}
            scanEnabled={scanEnabled}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetView={resetView}
            onFitToView={fitToView}
            onToggleAutoLayout={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
            onToggleAutoOpen={handleToggleAutoOpenPreference}
            onToggleScan={toggleScan}
            onExportImage={handleExportImage}
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
              faultLanes={faultLanes}
            />

            {/* Nodes - render visible nodes */}
            {visibleNodes.map((node) => (
              <FlowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                isGoToTarget={(goToTargetCounts.get(node.id) ?? 0) > 0}
                incomingGoToCount={goToTargetCounts.get(node.id) || 0}
                isCollapsed={isCollapsed(node.id)}
                isBranchingNode={branchingNodeIds.has(node.id)}
                onSelect={selectNode}
                onToggleCollapse={toggleCollapse}
                violations={violationsByElement.get(node.id) || []}
                onOpenQualityTab={() => {
                  setSidebarTab("quality");
                  setSidebarOpen(true);
                }}
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
