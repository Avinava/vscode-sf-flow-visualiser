/**
 * Flow Scanner Service
 *
 * Runs lightning-flow-scanner analysis in Node.js context
 * and returns results to the webview
 */

import { parse, scan } from "@flow-scanner/lightning-flow-scanner-core";

export interface FlowScannerResult {
  success: boolean;
  violations: FlowViolation[];
  cyclomaticComplexity: number;
  violationsBySeverity: {
    error: number;
    warning: number;
    note: number;
  };
  totalViolations: number;
  errorMessage?: string;
}

export interface FlowViolation {
  rule: string;
  ruleLabel: string;
  severity: "error" | "warning" | "note";
  message: string;
  elementName?: string;
  elementType?: string;
  docLink?: string;
}

// Severity overrides for rules where we want different severity than the library default
const SEVERITY_OVERRIDES: Record<string, "error" | "warning" | "note"> = {
  DMLStatementInLoop: "error",
  SOQLQueryInLoop: "error",
  MissingFaultPath: "error",
  HardcodedId: "warning",
  HardcodedUrl: "warning",
  DuplicateDMLOperation: "warning",
  UnconnectedElement: "warning",
};

function mapSeverity(
  ruleName: string,
  scannerSeverity?: string
): "error" | "warning" | "note" {
  // Check for override first
  if (SEVERITY_OVERRIDES[ruleName]) {
    return SEVERITY_OVERRIDES[ruleName];
  }

  // Otherwise use the scanner's severity
  switch (scannerSeverity?.toLowerCase()) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "note":
    case "info":
    default:
      return "note";
  }
}

/**
 * Analyze a flow XML string using lightning-flow-scanner
 */
export async function analyzeFlowXML(
  flowXml: string
): Promise<FlowScannerResult> {
  const os = await import("os");
  const fs = await import("fs/promises");
  const path = await import("path");

  let tmpFilePath: string | null = null;

  try {
    console.log("[Extension FlowScanner] Starting analysis...");

    // Write XML to temp file since parse() expects file paths
    const tmpDir = os.tmpdir();
    tmpFilePath = path.join(tmpDir, `flow-${Date.now()}.flow-meta.xml`);
    await fs.writeFile(tmpFilePath, flowXml, "utf-8");
    console.log("[Extension FlowScanner] Wrote temp file:", tmpFilePath);

    // Parse the flow XML from file path
    const flows = await parse([tmpFilePath]);
    console.log(`[Extension FlowScanner] Parsed ${flows.length} flow(s)`);

    // Run the scanner (use library defaults for all rules)
    const scanResults = await scan(flows);
    console.log(
      `[Extension FlowScanner] Scan found ${scanResults.length} result(s)`
    );

    // Extract violations
    const violations: FlowViolation[] = [];
    let cyclomaticComplexity = 0;

    for (const result of scanResults) {
      if (!result.ruleResults || result.ruleResults.length === 0) {
        continue;
      }

      for (const ruleResult of result.ruleResults) {
        // Get metadata directly from the rule definition provided by flow-scanner
        const ruleDef = ruleResult.ruleDefinition;
        const ruleName = ruleResult.ruleName || "Unknown";
        const ruleLabel = ruleDef?.label || ruleName;
        const ruleDescription =
          ruleDef?.description || "Flow quality issue detected.";
        const docLink = ruleDef?.docRefs?.[0]?.path;

        const ruleViolations = ruleResult.details || [];

        console.log(
          "[Extension FlowScanner] Rule:",
          ruleName,
          "occurs:",
          ruleResult.occurs,
          "violations:",
          ruleViolations.length
        );

        for (const violation of ruleViolations) {
          violations.push({
            rule: ruleName,
            ruleLabel,
            severity: mapSeverity(ruleName, ruleResult.severity),
            message: ruleDescription,
            elementName: violation.name,
            elementType: violation.metaType || violation.type,
            docLink,
          });
        }

        // Extract cyclomatic complexity
        if (ruleName === "CyclomaticComplexity" && ruleViolations.length > 0) {
          const match = ruleViolations[0].name?.match(/(\d+)/);
          if (match) {
            cyclomaticComplexity = parseInt(match[1], 10);
          }
        }
      }
    }

    // Count by severity
    const violationsBySeverity = {
      error: violations.filter((v) => v.severity === "error").length,
      warning: violations.filter((v) => v.severity === "warning").length,
      note: violations.filter((v) => v.severity === "note").length,
    };

    console.log(
      `[Extension FlowScanner] Analysis complete: ${violations.length} violations found`
    );

    return {
      success: true,
      violations,
      cyclomaticComplexity,
      violationsBySeverity,
      totalViolations: violations.length,
    };
  } catch (error) {
    console.error("[Extension FlowScanner] Analysis error:", error);
    return {
      success: false,
      violations: [],
      cyclomaticComplexity: 0,
      violationsBySeverity: { error: 0, warning: 0, note: 0 },
      totalViolations: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up temp file
    if (tmpFilePath) {
      try {
        const fs = await import("fs/promises");
        await fs.unlink(tmpFilePath);
        console.log("[Extension FlowScanner] Cleaned up temp file");
      } catch (cleanupError) {
        console.warn(
          "[Extension FlowScanner] Failed to cleanup temp file:",
          cleanupError
        );
      }
    }
  }
}
