/**
 * Collapse Context
 *
 * Manages the collapsed state of branching nodes (Decision, Wait, Loop).
 * When a node is collapsed, its branches are hidden and the flow continues
 * from the merge point.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface CollapseContextValue {
  /** Set of node IDs that are currently collapsed */
  collapsedNodes: Set<string>;
  /** Check if a node is collapsed */
  isCollapsed: (nodeId: string) => boolean;
  /** Toggle collapse state for a node */
  toggleCollapse: (nodeId: string) => void;
  /** Collapse a node */
  collapse: (nodeId: string) => void;
  /** Expand a node */
  expand: (nodeId: string) => void;
  /** Expand all nodes */
  expandAll: () => void;
  /** Collapse all branching nodes */
  collapseAll: (branchingNodeIds: string[]) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CollapseContext = createContext<CollapseContextValue | null>(null);

// ============================================================================
// HOOK
// ============================================================================

export function useCollapse(): CollapseContextValue {
  const context = useContext(CollapseContext);
  if (!context) {
    throw new Error("useCollapse must be used within a CollapseProvider");
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface CollapseProviderProps {
  children: React.ReactNode;
}

export const CollapseProvider: React.FC<CollapseProviderProps> = ({
  children,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const isCollapsed = useCallback(
    (nodeId: string) => collapsedNodes.has(nodeId),
    [collapsedNodes]
  );

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const collapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => new Set(prev).add(nodeId));
  }, []);

  const expand = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const collapseAll = useCallback((branchingNodeIds: string[]) => {
    setCollapsedNodes(new Set(branchingNodeIds));
  }, []);

  const value = useMemo(
    () => ({
      collapsedNodes,
      isCollapsed,
      toggleCollapse,
      collapse,
      expand,
      expandAll,
      collapseAll,
    }),
    [
      collapsedNodes,
      isCollapsed,
      toggleCollapse,
      collapse,
      expand,
      expandAll,
      collapseAll,
    ]
  );

  return (
    <CollapseContext.Provider value={value}>
      {children}
    </CollapseContext.Provider>
  );
};

export default CollapseProvider;
