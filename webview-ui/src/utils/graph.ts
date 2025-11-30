/**
 * Graph utilities shared across the flow parser, layout engine, and renderer.
 *
 * These helpers centralize Salesforce-specific behaviors such as branching
 * detection/sorting so that the parser and renderer stay in sync with how the
 * auto-layout engine treats connectors.
 */

import type { FlowEdge, FlowNode } from "../types";

/** Default-ish labels Salesforce uses for right-most decision branches */
const DEFAULT_BRANCH_LABELS = ["default", "other", "default outcome"];

/** Determine whether the provided edge represents a default branch */
export function isDefaultBranchEdge(edge: FlowEdge): boolean {
  const label = edge.label?.toLowerCase() || "";
  return (
    DEFAULT_BRANCH_LABELS.some((token) => label.includes(token)) ||
    edge.id.includes("-def")
  );
}

/** Determine whether the provided edge is an async/scheduled path from Start */
export function isAsyncStartEdge(edge: FlowEdge): boolean {
  const label = edge.label?.toLowerCase() || "";
  return (
    label.includes("async") ||
    label.includes("scheduled") ||
    edge.id.includes("-sched")
  );
}

/**
 * Branch edges are the subset of outgoing connectors that should be rendered as
 * horizontal spreads (decision rules, wait events, scheduled paths, etc.).
 */
export function getBranchEdgesForNode(
  node: FlowNode,
  outgoingEdges: FlowEdge[]
): FlowEdge[] {
  if (node.type === "LOOP") {
    return outgoingEdges.filter(
      (edge) => edge.type === "loop-next" || edge.type === "loop-end"
    );
  }

  if (node.type === "DECISION" || node.type === "WAIT") {
    return outgoingEdges.filter(
      (edge) => edge.type !== "fault" && edge.type !== "fault-end"
    );
  }

  if (node.type === "START") {
    return outgoingEdges.filter(
      (edge) => edge.type !== "fault" && edge.type !== "fault-end"
    );
  }

  return [];
}

/**
 * Salesforce keeps default/async branches on the right-hand side. All other
 * branches maintain their original ordering.
 */
export function sortBranchEdges(
  node: FlowNode,
  branchEdges: FlowEdge[]
): FlowEdge[] {
  if (branchEdges.length <= 1) {
    return branchEdges;
  }

  return [...branchEdges].sort((a, b) => {
    if (node.type === "LOOP") {
      if (a.type === "loop-end" && b.type !== "loop-end") return 1;
      if (a.type !== "loop-end" && b.type === "loop-end") return -1;
      return 0;
    }

    if (node.type === "START") {
      const aAsync = isAsyncStartEdge(a);
      const bAsync = isAsyncStartEdge(b);
      if (aAsync && !bAsync) return 1;
      if (!aAsync && bAsync) return -1;
      return 0;
    }

    // Decision / Wait
    const aDefault = isDefaultBranchEdge(a);
    const bDefault = isDefaultBranchEdge(b);
    if (aDefault && !bDefault) return 1;
    if (!aDefault && bDefault) return -1;
    return 0;
  });
}

/** Quick helper to determine if a node behaves like a branching container */
export function isBranchingNode(node: FlowNode, branchCount: number): boolean {
  if (node.type === "LOOP") {
    return branchCount > 1; // loop-next + loop-end
  }

  if (node.type === "DECISION" || node.type === "WAIT") {
    return branchCount > 1;
  }

  if (node.type === "START") {
    return branchCount > 1;
  }

  return false;
}
