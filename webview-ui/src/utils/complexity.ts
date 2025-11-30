/**
 * Flow Complexity Calculator
 *
 * Calculates cyclomatic complexity and other metrics for Salesforce Flows.
 *
 * Cyclomatic Complexity (CC) measures the number of linearly independent paths:
 * CC = E - N + 2P
 * Where:
 * - E = number of edges
 * - N = number of nodes
 * - P = number of connected components (usually 1 for flows)
 *
 * Salesforce-specific complexity factors:
 * - Decision nodes add (outcomes - 1) complexity
 * - Loop nodes add 1 complexity (for the loop back)
 * - Wait nodes with multiple paths add complexity
 * - Fault handling adds complexity
 *
 * Complexity Ratings:
 * - 1-10: Simple, low risk
 * - 11-20: More complex, moderate risk
 * - 21-50: Complex, high risk
 * - 50+: Very complex, very high risk - consider refactoring
 */

import type { FlowNode, FlowEdge, NodeType } from "../types";

export interface ComplexityMetrics {
  /** Cyclomatic complexity score */
  cyclomaticComplexity: number;
  /** Complexity rating label */
  rating: "simple" | "moderate" | "complex" | "very-complex";
  /** Color for display */
  color: string;
  /** Human-readable description */
  description: string;
  /** Breakdown of complexity factors */
  breakdown: {
    /** Base complexity (always 1) */
    base: number;
    /** Complexity from decision nodes */
    decisions: number;
    /** Complexity from loop nodes */
    loops: number;
    /** Complexity from wait nodes */
    waits: number;
    /** Complexity from fault handling */
    faults: number;
  };
  /** Node count by type */
  nodesByType: Record<string, number>;
  /** Total nodes */
  totalNodes: number;
  /** Total edges */
  totalEdges: number;
  /** Recommendations based on complexity */
  recommendations: string[];
}

/**
 * Count decision outcomes (branches) for a decision node
 */
function countDecisionOutcomes(nodeId: string, edges: FlowEdge[]): number {
  return edges.filter(
    (e) => e.source === nodeId && e.type !== "fault" && e.type !== "fault-end"
  ).length;
}

/**
 * Count fault paths from a node
 */
function countFaultPaths(nodeId: string, edges: FlowEdge[]): number {
  return edges.filter(
    (e) => e.source === nodeId && (e.type === "fault" || e.type === "fault-end")
  ).length;
}

/**
 * Calculate cyclomatic complexity for a Salesforce Flow
 */
export function calculateComplexity(
  nodes: FlowNode[],
  edges: FlowEdge[]
): ComplexityMetrics {
  // Count nodes by type
  const nodesByType: Record<string, number> = {};
  const nodeTypes: NodeType[] = [];

  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    nodeTypes.push(node.type);
  }

  // Calculate complexity breakdown
  const breakdown = {
    base: 1, // Every flow starts with complexity of 1
    decisions: 0,
    loops: 0,
    waits: 0,
    faults: 0,
  };

  // Process each node for complexity
  for (const node of nodes) {
    switch (node.type) {
      case "DECISION": {
        // Each additional outcome adds 1 to complexity
        const outcomes = countDecisionOutcomes(node.id, edges);
        if (outcomes > 1) {
          breakdown.decisions += outcomes - 1;
        }
        break;
      }
      case "WAIT": {
        // Wait nodes with multiple scheduled paths add complexity
        const waitOutcomes = countDecisionOutcomes(node.id, edges);
        if (waitOutcomes > 1) {
          breakdown.waits += waitOutcomes - 1;
        }
        break;
      }
      case "LOOP": {
        // Each loop adds 1 complexity for the back edge
        breakdown.loops += 1;
        break;
      }
      default:
        break;
    }

    // Fault handling adds complexity
    const faults = countFaultPaths(node.id, edges);
    breakdown.faults += faults;
  }

  // Calculate total cyclomatic complexity
  const cyclomaticComplexity =
    breakdown.base +
    breakdown.decisions +
    breakdown.loops +
    breakdown.waits +
    breakdown.faults;

  // Determine rating
  let rating: ComplexityMetrics["rating"];
  let color: string;
  let description: string;

  if (cyclomaticComplexity <= 10) {
    rating = "simple";
    color = "#22c55e"; // Green
    description = "Simple flow, easy to maintain";
  } else if (cyclomaticComplexity <= 20) {
    rating = "moderate";
    color = "#f59e0b"; // Amber
    description = "Moderate complexity";
  } else if (cyclomaticComplexity <= 50) {
    rating = "complex";
    color = "#f97316"; // Orange
    description = "Complex flow, consider breaking into subflows";
  } else {
    rating = "very-complex";
    color = "#ef4444"; // Red
    description = "Very complex, high maintenance risk";
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (breakdown.decisions > 5) {
    recommendations.push(
      "Consider consolidating decision logic or using formulas"
    );
  }
  if (breakdown.loops > 3) {
    recommendations.push(
      "Multiple loops detected - check for optimization opportunities"
    );
  }
  if (breakdown.faults > 5) {
    recommendations.push(
      "Many fault handlers - consider a centralized error handling pattern"
    );
  }
  if (nodes.length > 30) {
    recommendations.push(
      "Large flow - consider breaking into smaller subflows"
    );
  }
  if ((nodesByType["RECORD_LOOKUP"] || 0) > 5) {
    recommendations.push(
      "Many record lookups - check for SOQL optimization opportunities"
    );
  }
  if (cyclomaticComplexity > 15 && recommendations.length === 0) {
    recommendations.push("Consider adding inline documentation for clarity");
  }

  return {
    cyclomaticComplexity,
    rating,
    color,
    description,
    breakdown,
    nodesByType,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    recommendations,
  };
}

/**
 * Get complexity badge color class
 */
export function getComplexityColorClass(
  rating: ComplexityMetrics["rating"]
): string {
  switch (rating) {
    case "simple":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "moderate":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "complex":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "very-complex":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
