/**
 * Lightning Flow Scanner Integration
 *
 * Integrates the lightning-flow-scanner-core library to provide comprehensive
 * flow quality analysis beyond basic cyclomatic complexity.
 *
 * Provides analysis for:
 * - Performance issues (DML/SOQL in loops, duplicate operations)
 * - Security concerns (hardcoded IDs/URLs, unsafe contexts)
 * - Best practices (naming, API versions, fault handlers)
 * - Maintainability (complexity, descriptions, inactive flows)
 */

import { getVSCodeApi } from "../utils/vscodeApi";

// ============================================================================
// TYPES
// ============================================================================

export type ViolationSeverity = "error" | "warning" | "note";

export interface FlowViolation {
  /** Rule name (e.g., "DMLStatementInLoop", "HardcodedId") */
  rule: string;
  /** Human-readable rule label */
  ruleLabel: string;
  /** Severity level */
  severity: ViolationSeverity;
  /** Violation message/description */
  message: string;
  /** Element name where violation occurred (if applicable) */
  elementName?: string;
  /** Element type (e.g., "recordUpdates", "decisions") */
  elementType?: string;
  /** Link to rule documentation */
  docLink?: string;
}

export interface FlowQualityMetrics {
  /** Cyclomatic complexity from flow-scanner */
  cyclomaticComplexity: number;
  /** All violations found */
  violations: FlowViolation[];
  /** Violations grouped by rule name */
  violationsByRule: Record<string, FlowViolation[]>;
  /** Violation counts by severity */
  violationsBySeverity: {
    error: number;
    warning: number;
    note: number;
  };
  /** Total violation count */
  totalViolations: number;
}

export interface FlowScannerOptions {
  /** Specific rules to run (defaults to all) */
  rules?: string[];
  /** Rule-specific thresholds */
  thresholds?: Record<string, number>;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a Salesforce Flow XML string for quality issues
 *
 * Delegates to the VS Code extension (Node.js context) which has
 * access to the lightning-flow-scanner library.
 *
 * @param flowXml - The flow XML content as a string
 * @returns Quality metrics including violations and complexity
 */
export async function analyzeFlow(
  flowXml: string
): Promise<FlowQualityMetrics> {
  try {
    // Generate unique request ID to match response
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log("[FlowScanner] Requesting analysis from extension...", {
      requestId,
    });

    return new Promise((resolve) => {
      const api = getVSCodeApi();
      if (!api) {
        console.error("[FlowScanner] VS Code API not available");
        resolve({
          cyclomaticComplexity: 0,
          violations: [],
          violationsByRule: {},
          violationsBySeverity: { error: 0, warning: 0, note: 0 },
          totalViolations: 0,
        });
        return;
      }

      let timeoutId: number | undefined;
      let resolved = false;

      // Listen for response (one-time listener with request ID matching)
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;

        if (message.command === "flowAnalysisResult") {
          // Check if this response matches our request ID
          if (message.requestId !== requestId) {
            console.log(
              "[FlowScanner] Ignoring response for different request:",
              message.requestId,
              "expected:",
              requestId
            );
            return; // Not our response, ignore it
          }

          console.log(
            "[FlowScanner] Received result from extension:",
            message.payload,
            { requestId }
          );

          if (resolved) return; // Already resolved
          resolved = true;

          window.removeEventListener("message", handleMessage);
          if (timeoutId) clearTimeout(timeoutId);

          const result = message.payload;

          if (result.success) {
            resolve({
              cyclomaticComplexity: result.cyclomaticComplexity,
              violations: result.violations,
              violationsByRule: groupViolationsByRule(result.violations),
              violationsBySeverity: result.violationsBySeverity,
              totalViolations: result.totalViolations,
            });
          } else {
            console.error(
              "[FlowScanner] Analysis failed:",
              result.errorMessage
            );
            resolve({
              cyclomaticComplexity: 0,
              violations: [],
              violationsByRule: {},
              violationsBySeverity: { error: 0, warning: 0, note: 0 },
              totalViolations: 0,
            });
          }
        }
      };

      window.addEventListener("message", handleMessage);

      // Send analysis request to extension with request ID
      api.postMessage({
        command: "analyzeFlow",
        payload: flowXml,
        requestId,
      });

      // Timeout fallback (30 seconds)
      timeoutId = window.setTimeout(() => {
        if (resolved) return; // Already resolved
        resolved = true;

        window.removeEventListener("message", handleMessage);
        console.warn(
          "[FlowScanner] Analysis timeout - returning empty results",
          { requestId }
        );
        resolve({
          cyclomaticComplexity: 0,
          violations: [],
          violationsByRule: {},
          violationsBySeverity: { error: 0, warning: 0, note: 0 },
          totalViolations: 0,
        });
      }, 30000);
    });
  } catch (error) {
    console.error("[FlowScanner] Analysis error:", error);
    return {
      cyclomaticComplexity: 0,
      violations: [],
      violationsByRule: {},
      violationsBySeverity: { error: 0, warning: 0, note: 0 },
      totalViolations: 0,
    };
  }
}

/**
 * Helper to group violations by rule
 */
function groupViolationsByRule(
  violations: FlowViolation[]
): Record<string, FlowViolation[]> {
  const grouped: Record<string, FlowViolation[]> = {};
  for (const violation of violations) {
    if (!grouped[violation.rule]) {
      grouped[violation.rule] = [];
    }
    grouped[violation.rule].push(violation);
  }
  return grouped;
}

/**
 * Get a human-readable summary of quality metrics
 */
export function getQualitySummary(metrics: FlowQualityMetrics): string {
  const { violationsBySeverity } = metrics;
  const parts: string[] = [];

  if (violationsBySeverity.error > 0) {
    parts.push(
      `${violationsBySeverity.error} error${violationsBySeverity.error > 1 ? "s" : ""}`
    );
  }
  if (violationsBySeverity.warning > 0) {
    parts.push(
      `${violationsBySeverity.warning} warning${violationsBySeverity.warning > 1 ? "s" : ""}`
    );
  }
  if (violationsBySeverity.note > 0) {
    parts.push(
      `${violationsBySeverity.note} note${violationsBySeverity.note > 1 ? "s" : ""}`
    );
  }

  if (parts.length === 0) {
    return "No issues found";
  }

  return parts.join(", ");
}
