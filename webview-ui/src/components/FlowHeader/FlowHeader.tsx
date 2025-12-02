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
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import type { FlowMetadata } from "../../types";
import type { ComplexityMetrics } from "../../utils/complexity";
import type { FlowQualityMetrics } from "../../utils/flow-scanner";
import {
  getBadgeClass,
  getComplexityRange,
  getProgressBarColor,
} from "../../utils/complexity";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowHeaderProps {
  metadata: FlowMetadata;
  fileName?: string;
  complexity?: ComplexityMetrics | null;
  qualityMetrics?: FlowQualityMetrics | null;
  onOpenQualityTab?: () => void;
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
 * Get human-readable trigger type label (short version for header)
 */
function getTriggerTypeLabel(
  triggerType?: string,
  recordTriggerType?: string
): string {
  if (!triggerType) return "";

  const triggers: Record<string, string> = {
    RecordAfterSave: "After",
    RecordBeforeSave: "Before",
    RecordBeforeDelete: "Before Delete",
    Scheduled: "Scheduled",
    PlatformEvent: "Platform Event",
  };

  const triggerLabel = triggers[triggerType] || triggerType;

  // Add record trigger type info (Create, Update, CreateOrUpdate, Delete)
  if (recordTriggerType) {
    const recordTypes: Record<string, string> = {
      Create: "Create",
      Update: "Update",
      CreateOrUpdate: "Create/Update",
      Delete: "Delete",
    };
    const recordLabel = recordTypes[recordTriggerType] || recordTriggerType;
    return `${triggerLabel} ${recordLabel}`;
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

const QualityStatus: React.FC<{
  complexity: ComplexityMetrics;
  qualityMetrics?: FlowQualityMetrics | null;
  onOpenQualityTab?: () => void;
}> = ({ complexity, qualityMetrics, onOpenQualityTab }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"complexity" | "scan">("complexity");

  // Derive display values from score using centralized functions
  const { score, breakdown } = complexity;
  const range = getComplexityRange(score);
  
  // Determine overall status
  const hasErrors = qualityMetrics?.violationsBySeverity.error ? qualityMetrics.violationsBySeverity.error > 0 : false;
  const hasWarnings = qualityMetrics?.violationsBySeverity.warning ? qualityMetrics.violationsBySeverity.warning > 0 : false;
  const isHighComplexity = score > 20;

  let statusColor = "text-slate-600 dark:text-slate-400";
  let statusBg = "bg-slate-100 dark:bg-slate-800";
  let StatusIcon = Activity;

  if (hasErrors) {
    statusColor = "text-red-600 dark:text-red-400";
    statusBg = "bg-red-50 dark:bg-red-900/20";
    StatusIcon = ShieldAlert;
  } else if (hasWarnings || isHighComplexity) {
    statusColor = "text-amber-600 dark:text-amber-400";
    statusBg = "bg-amber-50 dark:bg-amber-900/20";
    StatusIcon = AlertTriangle;
  } else {
    statusColor = "text-green-600 dark:text-green-400";
    statusBg = "bg-green-50 dark:bg-green-900/20";
    StatusIcon = ShieldCheck;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${statusBg} ${statusColor}`}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        <span className="font-semibold">
          {hasErrors ? "Issues Found" : hasWarnings ? "Warnings" : "Good Quality"}
        </span>
        <div className="w-px h-3 bg-current opacity-20 mx-0.5" />
        <span className="opacity-80">CC: {score}</span>
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
          <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${statusBg}`}>
                  <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    Flow Quality Report
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {hasErrors 
                      ? "Critical issues detected" 
                      : hasWarnings 
                        ? "Improvements recommended" 
                        : "No major issues found"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-700/50 px-2 pt-2">
              <button
                onClick={() => setActiveTab("complexity")}
                className={`flex-1 pb-2 text-xs font-medium transition-colors relative ${
                  activeTab === "complexity"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Complexity
                {activeTab === "complexity" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full mx-4" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("scan")}
                className={`flex-1 pb-2 text-xs font-medium transition-colors relative ${
                  activeTab === "scan"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Scan Results
                {qualityMetrics && qualityMetrics.totalViolations > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[9px]">
                    {qualityMetrics.totalViolations}
                  </span>
                )}
                {activeTab === "scan" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full mx-4" />
                )}
              </button>
            </div>

            {/* Content Area */}
            <div className="overflow-y-auto flex-1 p-4 custom-scrollbar">
              {activeTab === "complexity" ? (
                <div className="space-y-5">
                  {/* Score and Rating */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                          {score}
                        </span>
                        <span className="text-sm text-slate-400 ml-1 font-medium">/ 50</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Cyclomatic Complexity
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold inline-block mb-1 ${getBadgeClass(score)}`}
                      >
                        {range.label}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/5">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${getProgressBarColor(score)}`}
                        style={{ width: `${Math.min(100, (score / 50) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                      <span>Simple</span>
                      <span>Moderate</span>
                      <span>Complex</span>
                      <span>High Risk</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                    {range.description}
                  </p>

                  {/* Breakdown */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                      Score Breakdown
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-slate-600 dark:text-slate-400">Base (start node)</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {breakdown.base}
                        </span>
                      </div>
                      {breakdown.decisions > 0 && (
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-600 dark:text-slate-400">Decision branches</span>
                          <span className="font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                            +{breakdown.decisions}
                          </span>
                        </div>
                      )}
                      {breakdown.loops > 0 && (
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-600 dark:text-slate-400">Loop iterations</span>
                          <span className="font-mono font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded">
                            +{breakdown.loops}
                          </span>
                        </div>
                      )}
                      {breakdown.waits > 0 && (
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-600 dark:text-slate-400">Wait paths</span>
                          <span className="font-mono font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded">
                            +{breakdown.waits}
                          </span>
                        </div>
                      )}
                      {breakdown.faults > 0 && (
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-600 dark:text-slate-400">Fault handlers</span>
                          <span className="font-mono font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                            +{breakdown.faults}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Explanation Footer (Restored) */}
                  <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5">
                      <p className="font-medium text-slate-700 dark:text-slate-300">Cyclomatic Complexity (CC)</p>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                        The number of linearly independent paths through a program. Each decision point (if/else, loop, wait) adds a new path.
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="font-medium">Formula:</span> CC = E - N + 2P
                        <br />
                        <span className="text-[9px] opacity-80">
                          (E = edges, N = nodes, P = connected components)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!qualityMetrics ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>Scan data not available</p>
                    </div>
                  ) : qualityMetrics.totalViolations === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle size={24} />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">All Clear!</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        No quality violations found in this flow.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {qualityMetrics.violationsBySeverity.error}
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-red-500/80">Errors</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {qualityMetrics.violationsBySeverity.warning}
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-amber-500/80">Warnings</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {qualityMetrics.violationsBySeverity.note}
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-blue-500/80">Notes</div>
                        </div>
                      </div>

                      {/* Top Issues List */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-2">
                          Top Issues
                        </div>
                        <div className="space-y-2">
                          {qualityMetrics.violations.slice(0, 5).map((v, idx) => (
                            <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                              {v.severity === 'error' ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                              ) : v.severity === 'warning' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {v.ruleLabel}
                                </p>
                                {v.elementName && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    in {v.elementName}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                          {qualityMetrics.violations.length > 5 && (
                            <div className="text-center pt-1">
                              <span className="text-[10px] text-slate-400 italic">
                                +{qualityMetrics.violations.length - 5} more issues
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50 text-[10px] text-slate-400 flex justify-between items-center">
              <span>
                {activeTab === 'complexity' ? 'Based on node analysis' : 'Powered by Flow Scanner'}
              </span>
              {activeTab === 'scan' && qualityMetrics && (
                 <button 
                   onClick={() => {
                     setShowDetails(false);
                     onOpenQualityTab?.();
                   }}
                   className="flex items-center gap-1 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline bg-transparent border-none p-0 font-inherit"
                 >
                   View Full Report <ChevronRight size={10} />
                 </button>
              )}
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
  qualityMetrics,
  onOpenQualityTab,
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
          <div className="min-w-0">
            <h1
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
              title={metadata.description || flowName}
            >
              {flowName}
            </h1>
            {/* Description - show truncated if present */}
            {metadata.description && (
              <p
                className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[300px]"
                title={metadata.description}
              >
                {metadata.description}
              </p>
            )}
          </div>
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

        {/* Center/Right: Quality Status with clickable popover */}
        {complexity && (
          <QualityStatus 
            complexity={complexity} 
            qualityMetrics={qualityMetrics} 
            onOpenQualityTab={onOpenQualityTab}
          />
        )}

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
