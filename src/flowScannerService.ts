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

const RULE_METADATA: Record<
  string,
  { label: string; description: string; docAnchor: string }
> = {
  CyclomaticComplexity: {
    label: "Cyclomatic Complexity",
    description:
      "Flow complexity is too high. Consider breaking into smaller subflows.",
    docAnchor: "cyclomatic-complexity",
  },
  DMLStatementInLoop: {
    label: "DML Statement In Loop",
    description:
      "Database operations inside loops can exceed governor limits. Move DML outside loops.",
    docAnchor: "dml-statement-in-a-loop",
  },
  SOQLQueryInLoop: {
    label: "SOQL Query In Loop",
    description:
      "SOQL queries inside loops can exceed governor limits. Move queries outside loops.",
    docAnchor: "soql-query-in-a-loop",
  },
  HardcodedId: {
    label: "Hardcoded ID",
    description:
      "Hardcoded IDs are org-specific and will break in other environments.",
    docAnchor: "hardcoded-id",
  },
  HardcodedUrl: {
    label: "Hardcoded URL",
    description:
      "Hardcoded URLs are environment-specific. Use $API formula or custom labels.",
    docAnchor: "hardcoded-url",
  },
  MissingFaultPath: {
    label: "Missing Fault Path",
    description:
      "Element lacks error handling. Add fault connectors for graceful error handling.",
    docAnchor: "missing-fault-path",
  },
  MissingNullHandler: {
    label: "Missing Null Handler",
    description:
      "Decision doesn't handle null/empty values. Add a null check to prevent runtime errors.",
    docAnchor: "missing-null-handler",
  },
  DuplicateDMLOperation: {
    label: "Duplicate DML Operation",
    description:
      "Duplicate database operations between screens. Prevent users from navigating backward.",
    docAnchor: "duplicate-dml-operation",
  },
  APIVersion: {
    label: "Outdated API Version",
    description:
      "Flow uses an outdated API version. Update to the latest version for best compatibility.",
    docAnchor: "outdated-api-version",
  },
  FlowName: {
    label: "Flow Naming Convention",
    description:
      "Flow name doesn't follow naming conventions. Use a clear, descriptive name with domain prefix.",
    docAnchor: "flow-naming-convention",
  },
  UnconnectedElement: {
    label: "Unconnected Element",
    description:
      "Element is not connected to the flow. Remove unused elements or connect them properly.",
    docAnchor: "unconnected-element",
  },
  MissingFlowDescription: {
    label: "Missing Flow Description",
    description:
      "Flow lacks a description. Add documentation to help others understand its purpose.",
    docAnchor: "missing-flow-description",
  },
  CopyAPIName: {
    label: "Copy API Name",
    description:
      "Element has a 'Copy_X_Of_' name pattern. Rename copied elements for clarity.",
    docAnchor: "copy-api-name",
  },
  GetRecordAllFields: {
    label: "Get Record All Fields",
    description:
      "Using 'Get all fields' violates principle of least privilege. Specify only needed fields.",
    docAnchor: "get-record-all-fields",
  },
  SameRecordFieldUpdates: {
    label: "Same Record Field Updates",
    description:
      "In Before-Save flows, use $Record variable assignments instead of Update Records elements for same-record updates. This is significantly faster.",
    docAnchor: "same-record-field-updates",
  },
  TriggerOrder: {
    label: "Trigger Order",
    description:
      "Consider setting explicit trigger order to control flow execution sequence.",
    docAnchor: "trigger-order",
  },
  FlowDescription: {
    label: "Missing Flow Description",
    description:
      "Flow lacks a description. Add documentation to help others understand its purpose.",
    docAnchor: "flow-description",
  },
};

function mapSeverity(scannerSeverity?: string): "error" | "warning" | "note" {
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

    // Configure scanner rules
    const config: any = {
      CyclomaticComplexity: { severity: "note" },
      DMLStatementInLoop: { severity: "error" },
      SOQLQueryInLoop: { severity: "error" },
      HardcodedId: { severity: "warning" },
      HardcodedUrl: { severity: "warning" },
      MissingFaultPath: { severity: "error" },
      MissingNullHandler: { severity: "note" },
      DuplicateDMLOperation: { severity: "warning" },
      APIVersion: { severity: "note" },
      FlowName: { severity: "note" },
      UnconnectedElement: { severity: "warning" },
      MissingFlowDescription: { severity: "note" },
      SameRecordFieldUpdates: { severity: "note" },
      TriggerOrder: { severity: "note" },
      CopyAPIName: { severity: "note" },
      GetRecordAllFields: { severity: "note" },
    };

    console.log(
      "[Extension FlowScanner] Config:",
      JSON.stringify(config, null, 2)
    );
    console.log("[Extension FlowScanner] Flows array:", flows);

    // Run the scanner
    const scanResults = await scan(flows, config);
    console.log(
      `[Extension FlowScanner] Scan found ${scanResults.length} result(s)`
    );
    console.log(
      "[Extension FlowScanner] Scan results detail:",
      JSON.stringify(scanResults, null, 2)
    );

    // Extract violations
    const violations: FlowViolation[] = [];
    let cyclomaticComplexity = 0;

    for (const result of scanResults) {
      console.log("[Extension FlowScanner] Processing result:", result);
      console.log(
        "[Extension FlowScanner] Rule results count:",
        result.ruleResults?.length
      );

      if (!result.ruleResults || result.ruleResults.length === 0) {
        continue;
      }

      for (const ruleResult of result.ruleResults) {
        console.log(
          "[Extension FlowScanner] Rule result:",
          ruleResult.ruleName,
          "occurs:",
          ruleResult.occurs,
          "details count:",
          ruleResult.details?.length
        );

        const ruleName = ruleResult.ruleName || "Unknown";
        const metadata = RULE_METADATA[ruleName] || {
          label: ruleName,
          description: "Flow quality issue detected.",
          docAnchor: "",
        };

        const ruleViolations = ruleResult.details || [];

        for (const violation of ruleViolations) {
          console.log("[Extension FlowScanner] Violation detail:", {
            ruleName,
            violationName: violation.name,
            violationType: violation.type,
            violationMetaType: violation.metaType,
          });
          violations.push({
            rule: ruleName,
            ruleLabel: metadata.label,
            severity: mapSeverity(ruleResult.severity),
            message: violation.name || metadata.description,
            elementName: violation.name,
            elementType: violation.metaType || violation.type,
            docLink: metadata.docAnchor
              ? `https://github.com/Flow-Scanner/lightning-flow-scanner#${metadata.docAnchor}`
              : undefined,
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
