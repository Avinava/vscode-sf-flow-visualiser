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
 */

import type { FlowNode, FlowEdge } from "../types";

// ============================================================================
// CONSTANTS & REFERENCE DATA
// ============================================================================

/** Valid complexity rating values */
export type ComplexityRating =
  | "simple"
  | "moderate"
  | "complex"
  | "high-risk"
  | "very-complex";

/**
 * Reference ranges for complexity scores
 * Single source of truth for all complexity thresholds and display data
 */
export const COMPLEXITY_RANGES: readonly ComplexityRangeConfig[] = [
  {
    min: 1,
    max: 5,
    range: "1-5",
    label: "Simple",
    rating: "simple",
    color: "bg-green-500",
    bgClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    hexColor: "#22c55e",
    description: "Easy to understand and maintain",
    testability: "Minimal test cases needed",
  },
  {
    min: 6,
    max: 10,
    range: "6-10",
    label: "Moderate",
    rating: "moderate",
    color: "bg-blue-500",
    bgClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    hexColor: "#3b82f6",
    description: "Reasonable complexity, still maintainable",
    testability: "Moderate test coverage recommended",
  },
  {
    min: 11,
    max: 20,
    range: "11-20",
    label: "Complex",
    rating: "complex",
    color: "bg-amber-500",
    bgClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    hexColor: "#f59e0b",
    description: "Consider breaking into smaller flows",
    testability: "Thorough testing required",
  },
  {
    min: 21,
    max: 50,
    range: "21-50",
    label: "High Risk",
    rating: "high-risk",
    color: "bg-orange-500",
    bgClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    hexColor: "#f97316",
    description: "Difficult to test and maintain",
    testability: "Many test paths needed",
  },
  {
    min: 51,
    max: Infinity,
    range: "50+",
    label: "Very High",
    rating: "very-complex",
    color: "bg-red-500",
    bgClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    hexColor: "#ef4444",
    description: "Should be refactored immediately",
    testability: "Untestable without refactoring",
  },
] as const;

/**
 * Information about cyclomatic complexity for educational display
 */
export const COMPLEXITY_INFO = {
  title: "Cyclomatic Complexity (CC)",
  formula: "CC = E − N + 2P",
  formulaExplanation: "E = edges, N = nodes, P = connected components",
  whatItMeasures:
    "The number of linearly independent paths through a program. Each decision point (if/else, loop, wait) adds a new path.",
  whyItMatters:
    "Lower scores mean easier testing and maintenance. Each independent path requires its own test case for full coverage.",
  salesforceFactors: [
    { type: "Decision", impact: "+1 per outcome" },
    { type: "Loop", impact: "+1 for the loop back edge" },
    { type: "Wait", impact: "+1 per scheduled path" },
    { type: "Fault Handler", impact: "+1 per fault path" },
  ],
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Configuration for a complexity range */
export interface ComplexityRangeConfig {
  /** Minimum score (inclusive) */
  min: number;
  /** Maximum score (inclusive) */
  max: number;
  /** Display range string */
  range: string;
  /** Human-readable label */
  label: string;
  /** Rating key */
  rating: ComplexityRating;
  /** Tailwind background color class */
  color: string;
  /** Tailwind badge classes (bg + text for light/dark) */
  bgClass: string;
  /** Hex color for charts/custom rendering */
  hexColor: string;
  /** Short description */
  description: string;
  /** Testability note */
  testability: string;
}

/** Breakdown of complexity contributing factors */
export interface ComplexityBreakdown {
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
}

/** Complete complexity metrics for a flow */
export interface ComplexityMetrics {
  /** Cyclomatic complexity score */
  score: number;
  /** Breakdown of complexity factors */
  breakdown: ComplexityBreakdown;
  /** Node count by type */
  nodesByType: Record<string, number>;
  /** Total nodes */
  totalNodes: number;
  /** Total edges */
  totalEdges: number;
  /** Recommendations based on complexity */
  recommendations: string[];
}

// ============================================================================
// RANGE LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get the complexity range configuration for a given score
 */
export function getComplexityRange(score: number): ComplexityRangeConfig {
  for (const range of COMPLEXITY_RANGES) {
    if (score >= range.min && score <= range.max) {
      return range;
    }
  }
  return COMPLEXITY_RANGES[COMPLEXITY_RANGES.length - 1];
}

/**
 * Get the index of the complexity range for a given score
 */
export function getComplexityRangeIndex(score: number): number {
  for (let i = 0; i < COMPLEXITY_RANGES.length; i++) {
    if (
      score >= COMPLEXITY_RANGES[i].min &&
      score <= COMPLEXITY_RANGES[i].max
    ) {
      return i;
    }
  }
  return COMPLEXITY_RANGES.length - 1;
}

// ============================================================================
// DERIVED GETTERS (convenience functions using getComplexityRange)
// ============================================================================

/** Get the rating for a score */
export const getRating = (score: number): ComplexityRating =>
  getComplexityRange(score).rating;

/** Get the badge CSS classes for a score */
export const getBadgeClass = (score: number): string =>
  getComplexityRange(score).bgClass;

/** Get the progress bar color class for a score */
export const getProgressBarColor = (score: number): string =>
  getComplexityRange(score).color;

/** Get the hex color for a score */
export const getHexColor = (score: number): string =>
  getComplexityRange(score).hexColor;

/** Get the description for a score */
export const getDescription = (score: number): string =>
  getComplexityRange(score).description;

/** Get the label for a score */
export const getLabel = (score: number): string =>
  getComplexityRange(score).label;

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Count decision outcomes (branches) for a node
 */
function countOutgoingBranches(nodeId: string, edges: FlowEdge[]): number {
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
 * Generate recommendations based on metrics
 */
function generateRecommendations(
  breakdown: ComplexityBreakdown,
  nodesByType: Record<string, number>,
  totalNodes: number,
  score: number
): string[] {
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
  if (totalNodes > 30) {
    recommendations.push(
      "Large flow - consider breaking into smaller subflows"
    );
  }
  if ((nodesByType["RECORD_LOOKUP"] || 0) > 5) {
    recommendations.push(
      "Many record lookups - check for SOQL optimization opportunities"
    );
  }
  if (score > 15 && recommendations.length === 0) {
    recommendations.push("Consider adding inline documentation for clarity");
  }

  return recommendations;
}

// ============================================================================
// MAIN CALCULATION
// ============================================================================

/**
 * Calculate cyclomatic complexity for a Salesforce Flow
 */
export function calculateComplexity(
  nodes: FlowNode[],
  edges: FlowEdge[]
): ComplexityMetrics {
  // Count nodes by type
  const nodesByType: Record<string, number> = {};
  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  // Calculate complexity breakdown
  const breakdown: ComplexityBreakdown = {
    base: 1,
    decisions: 0,
    loops: 0,
    waits: 0,
    faults: 0,
  };

  // Process each node for complexity
  for (const node of nodes) {
    switch (node.type) {
      case "DECISION": {
        const outcomes = countOutgoingBranches(node.id, edges);
        if (outcomes > 0) {
          // Flow Scanner logic: rules.length + 1 (which equals outcomes)
          // Standard logic was outcomes - 1
          breakdown.decisions += outcomes;
        }
        break;
      }
      case "WAIT": {
        const waitOutcomes = countOutgoingBranches(node.id, edges);
        if (waitOutcomes > 1) {
          breakdown.waits += waitOutcomes - 1;
        }
        break;
      }
      case "LOOP": {
        breakdown.loops += 1;
        break;
      }
    }

    // Fault handling adds complexity
    breakdown.faults += countFaultPaths(node.id, edges);
  }

  // Calculate total score
  const score =
    breakdown.base +
    breakdown.decisions +
    breakdown.loops +
    breakdown.waits +
    breakdown.faults;

  return {
    score,
    breakdown,
    nodesByType,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    recommendations: generateRecommendations(
      breakdown,
      nodesByType,
      nodes.length,
      score
    ),
  };
}

// ============================================================================
// LEGACY COMPATIBILITY (deprecated - use score-based functions instead)
// ============================================================================

/**
 * @deprecated Use getBadgeClass(score) instead
 */
export function getComplexityColorClass(rating: ComplexityRating): string {
  const range = COMPLEXITY_RANGES.find((r) => r.rating === rating);
  return range?.bgClass ?? "bg-slate-100 text-slate-600";
}
