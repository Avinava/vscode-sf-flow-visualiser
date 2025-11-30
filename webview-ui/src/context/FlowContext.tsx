/**
 * Flow Context
 *
 * Provides centralized state management for flow data across the application.
 * Includes parsed flow data, selection state, and flow manipulation actions.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { FlowNode, FlowEdge, FlowMetadata } from "../types";
import { useFlowParser } from "../hooks/useFlowParser";
import { useNodeSelection } from "../hooks/useNodeSelection";
import { useVSCodeMessaging } from "../hooks/useVSCodeMessaging";

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface FlowContextState {
  // Flow data
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: FlowMetadata;
  fileName: string;

  // Selection state
  selectedNode: FlowNode | null;
  selectNode: (node: FlowNode | null) => void;
  clearSelection: () => void;
  isNodeSelected: (nodeId: string) => boolean;

  // GoTo targets
  goToTargetCounts: Map<string, number>;
  isGoToTarget: (nodeId: string) => boolean;
  getGoToCount: (nodeId: string) => number;

  // Auto-layout
  autoLayoutEnabled: boolean;
  setAutoLayoutEnabled: (enabled: boolean) => void;

  // Flow loading
  loadFlow: (xml: string, fileName?: string) => void;

  // VS Code messaging
  postMessage: (message: unknown) => void;
  isVSCodeEnvironment: boolean;

  // Error state
  error: Error | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const FlowContext = createContext<FlowContextState | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface FlowProviderProps {
  children: ReactNode;
  initialXml?: string;
}

export const FlowProvider: React.FC<FlowProviderProps> = ({
  children,
  initialXml,
}) => {
  // Initialize hooks
  const flowParser = useFlowParser({ initialXml });
  const nodeSelection = useNodeSelection();

  // Handle VS Code message for loading XML
  const handleLoadXml = useCallback(
    (xml: string, fileName?: string) => {
      flowParser.loadFlow(xml, fileName);
      nodeSelection.clearSelection();
    },
    [flowParser, nodeSelection]
  );

  const vsCodeMessaging = useVSCodeMessaging({
    onLoadXml: handleLoadXml,
  });

  // GoTo target helpers
  const isGoToTarget = useCallback(
    (nodeId: string) => flowParser.goToTargetCounts.has(nodeId),
    [flowParser.goToTargetCounts]
  );

  const getGoToCount = useCallback(
    (nodeId: string) => flowParser.goToTargetCounts.get(nodeId) || 0,
    [flowParser.goToTargetCounts]
  );

  // Memoize context value
  const contextValue = useMemo<FlowContextState>(
    () => ({
      // Flow data
      nodes: flowParser.parsedData.nodes,
      edges: flowParser.parsedData.edges,
      metadata: flowParser.parsedData.metadata,
      fileName: flowParser.fileName,

      // Selection state
      selectedNode: nodeSelection.selectedNode,
      selectNode: nodeSelection.selectNode,
      clearSelection: nodeSelection.clearSelection,
      isNodeSelected: nodeSelection.isSelected,

      // GoTo targets
      goToTargetCounts: flowParser.goToTargetCounts,
      isGoToTarget,
      getGoToCount,

      // Auto-layout
      autoLayoutEnabled: flowParser.autoLayoutEnabled,
      setAutoLayoutEnabled: flowParser.setAutoLayoutEnabled,

      // Flow loading
      loadFlow: flowParser.loadFlow,

      // VS Code messaging
      postMessage: vsCodeMessaging.postMessage,
      isVSCodeEnvironment: vsCodeMessaging.isVSCodeEnvironment,

      // Error state
      error: flowParser.error,
    }),
    [
      flowParser.parsedData.nodes,
      flowParser.parsedData.edges,
      flowParser.parsedData.metadata,
      flowParser.fileName,
      flowParser.goToTargetCounts,
      flowParser.autoLayoutEnabled,
      flowParser.setAutoLayoutEnabled,
      flowParser.loadFlow,
      flowParser.error,
      nodeSelection.selectedNode,
      nodeSelection.selectNode,
      nodeSelection.clearSelection,
      nodeSelection.isSelected,
      vsCodeMessaging.postMessage,
      vsCodeMessaging.isVSCodeEnvironment,
      isGoToTarget,
      getGoToCount,
    ]
  );

  return (
    <FlowContext.Provider value={contextValue}>{children}</FlowContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access flow context
 *
 * @throws Error if used outside of FlowProvider
 */
export function useFlow(): FlowContextState {
  const context = useContext(FlowContext);

  if (!context) {
    throw new Error("useFlow must be used within a FlowProvider");
  }

  return context;
}

export default FlowContext;
