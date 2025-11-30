/**
 * Flow Header Component
 *
 * Displays flow metadata in a header bar similar to Salesforce Flow Builder.
 * Shows: flow name, description, status, object, trigger type, API version, complexity.
 *
 * Based on Salesforce's Flow Builder header patterns.
 */

import React, { useState } from "react";
import {
  FileText,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Zap,
  Code,
  Activity,
  X,
  AlertTriangle,
} from "lucide-react";
import type { FlowMetadata } from "../../types";
import type { ComplexityMetrics } from "../../utils/complexity";
import {
  getBadgeClass,
  getComplexityRange,
  getComplexityRangeIndex,
  getProgressBarColor,
  COMPLEXITY_RANGES,
  COMPLEXITY_INFO,
} from "../../utils/complexity";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowHeaderProps {
  metadata: FlowMetadata;
  fileName?: string;
  complexity?: ComplexityMetrics | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable process type label
 */
function getProcessTypeLabel(processType?: string): string {
  const types: Record<string, string> = {
    AutoLaunchedFlow: "Autolaunched Flow",
    Flow: "Screen Flow",
    Workflow: "Record-Triggered Flow",
    CustomEvent: "Platform Event-Triggered Flow",
    InvocableProcess: "Invocable Process",
    LoginFlow: "Login Flow",
    ActionPlan: "Action Plan",
    CheckoutFlow: "Checkout Flow",
    ContactRequestFlow: "Contact Request Flow",
    FSCLending: "FSC Lending Flow",
    FieldServiceMobile: "Field Service Mobile Flow",
    FieldServiceWeb: "Field Service Web Flow",
    IndividualObjectLinkingFlow: "Individual Object Linking Flow",
    Survey: "Survey Flow",
    SurveyEnrich: "Survey Enrich Flow",
    TransactionSecurityFlow: "Transaction Security Flow",
    UserProvisioningFlow: "User Provisioning Flow",
  };
  return types[processType || ""] || processType || "Flow";
}

/**
 * Get human-readable trigger type label
 */
function getTriggerTypeLabel(
  triggerType?: string,
  recordTriggerType?: string
): string {
  if (!triggerType) return "";

  const triggers: Record<string, string> = {
    RecordAfterSave: "After Save",
    RecordBeforeSave: "Before Save",
    RecordBeforeDelete: "Before Delete",
    Scheduled: "Scheduled",
    PlatformEvent: "Platform Event",
  };

  const triggerLabel = triggers[triggerType] || triggerType;

  // Add record trigger type info (Create, Update, CreateOrUpdate, Delete)
  if (recordTriggerType) {
    const recordTypes: Record<string, string> = {
      Create: "record is created",
      Update: "record is updated",
      CreateOrUpdate: "record is created or updated",
      Delete: "record is deleted",
    };
    const recordLabel = recordTypes[recordTriggerType] || recordTriggerType;
    return `${triggerLabel} - A ${recordLabel}`;
  }

  return triggerLabel;
}

/**
 * Get status badge styling
 */
function getStatusStyle(status?: string): {
  bg: string;
  text: string;
  icon: React.ElementType;
} {
  switch (status?.toLowerCase()) {
    case "active":
      return { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle };
    case "draft":
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: AlertCircle,
      };
    case "obsolete":
    case "inactive":
      return { bg: "bg-red-100", text: "text-red-700", icon: XCircle };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", icon: Info };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Complexity Badge with clickable popover showing details
 */
const ComplexityBadge: React.FC<{ complexity: ComplexityMetrics }> = ({
  complexity,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Derive display values from score using centralized functions
  const { score, breakdown, recommendations } = complexity;
  const range = getComplexityRange(score);
  const currentRangeIndex = getComplexityRangeIndex(score);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getBadgeClass(score)}`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span>CC: {score}</span>
        <span className="hidden sm:inline capitalize">({range.label})</span>
      </button>

      {/* Details Popover */}
      {showDetails && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          {/* Popover */}
          <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Cyclomatic Complexity
                </span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-4">
              {/* Score and Rating */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                    {score}
                  </span>
                  <span className="text-sm text-slate-400 ml-1">/ 50</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getBadgeClass(score)}`}
                >
                  {range.label}
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressBarColor(score)}`}
                    style={{ width: `${Math.min(100, (score / 50) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  {COMPLEXITY_RANGES.slice(0, 4).map((r) => (
                    <span key={r.rating}>{r.label}</span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {range.description}
              </p>

              {/* Reference Ranges */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                  Reference Ranges
                </div>
                <div className="space-y-1.5">
                  {COMPLEXITY_RANGES.map((ref, idx) => (
                    <div
                      key={ref.range}
                      className={`flex items-center gap-2 text-xs p-1.5 rounded ${
                        currentRangeIndex === idx
                          ? "bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-600"
                          : ""
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${ref.color} flex-shrink-0`}
                      />
                      <span className="font-mono text-slate-500 dark:text-slate-400 w-10">
                        {ref.range}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 w-16">
                        {ref.label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                        {ref.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                  Score Breakdown
                </div>
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-md p-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Base (start node)
                    </span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {breakdown.base}
                    </span>
                  </div>
                  {breakdown.decisions > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Decision branches
                      </span>
                      <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                        +{breakdown.decisions}
                      </span>
                    </div>
                  )}
                  {breakdown.loops > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Loop iterations
                      </span>
                      <span className="font-mono font-medium text-pink-600 dark:text-pink-400">
                        +{breakdown.loops}
                      </span>
                    </div>
                  )}
                  {breakdown.waits > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Wait paths
                      </span>
                      <span className="font-mono font-medium text-yellow-600 dark:text-yellow-400">
                        +{breakdown.waits}
                      </span>
                    </div>
                  )}
                  {breakdown.faults > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Fault handlers
                      </span>
                      <span className="font-mono font-medium text-red-600 dark:text-red-400">
                        +{breakdown.faults}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Total Score
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    Recommendations
                  </div>
                  <div className="space-y-1.5">
                    {recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded"
                      >
                        <AlertTriangle
                          size={12}
                          className="text-amber-500 mt-0.5 flex-shrink-0"
                        />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Salesforce-specific factors */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                Salesforce Flow Factors
              </div>
              <div className="grid grid-cols-2 gap-1">
                {COMPLEXITY_INFO.salesforceFactors.map((factor) => (
                  <div
                    key={factor.type}
                    className="text-[10px] text-slate-500 dark:text-slate-400"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {factor.type}:
                    </span>{" "}
                    <span>{factor.impact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with info */}
            <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg border-t border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-medium">{COMPLEXITY_INFO.title}</p>
                <p className="text-slate-400 dark:text-slate-500">
                  {COMPLEXITY_INFO.whatItMeasures}
                </p>
                <p className="text-slate-400 dark:text-slate-500 pt-1">
                  <span className="font-medium">Formula:</span>{" "}
                  {COMPLEXITY_INFO.formula}
                  <br />
                  <span className="text-[9px]">
                    ({COMPLEXITY_INFO.formulaExplanation})
                  </span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const FlowHeader: React.FC<FlowHeaderProps> = ({
  metadata,
  fileName,
  complexity,
}) => {
  const flowName =
    metadata.label ||
    fileName?.replace(".flow-meta.xml", "") ||
    "Untitled Flow";

  const processTypeLabel = getProcessTypeLabel(metadata.processType);
  const triggerLabel = getTriggerTypeLabel(
    metadata.triggerType,
    metadata.recordTriggerType
  );
  const statusStyle = getStatusStyle(metadata.status);
  const StatusIcon = statusStyle.icon;

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Flow Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {flowName}
          </h1>
          {/* Status Badge */}
          {metadata.status && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {metadata.status}
            </span>
          )}
          {/* Process Type & API Version */}
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline-flex items-center gap-1">
            <Code className="w-3 h-3" />
            {processTypeLabel}
            {metadata.apiVersion && (
              <span className="text-slate-300 dark:text-slate-600 ml-1">
                v{metadata.apiVersion}
              </span>
            )}
          </span>
        </div>

        {/* Center/Right: Complexity Score with clickable popover */}
        {complexity && <ComplexityBadge complexity={complexity} />}

        {/* Right: Trigger Info */}
        {(metadata.object || triggerLabel) && (
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            {metadata.object && (
              <span className="inline-flex items-center gap-1">
                <Database className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {metadata.object}
                </span>
              </span>
            )}
            {triggerLabel && (
              <span className="inline-flex items-center gap-1 hidden md:inline-flex">
                <Zap className="w-3 h-3" />
                {triggerLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowHeader;
