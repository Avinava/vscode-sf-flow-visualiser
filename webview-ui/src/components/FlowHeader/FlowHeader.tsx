/**
 * Flow Header Component
 *
 * Displays flow metadata in a header bar similar to Salesforce Flow Builder.
 * Shows: flow name, description, status, object, trigger type, API version.
 *
 * Based on Salesforce's Flow Builder header patterns.
 */

import React from "react";
import {
  FileText,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Zap,
  Code,
} from "lucide-react";
import type { FlowMetadata } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowHeaderProps {
  metadata: FlowMetadata;
  fileName?: string;
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

export const FlowHeader: React.FC<FlowHeaderProps> = ({
  metadata,
  fileName,
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
    <div className="bg-white border-b border-slate-200 shadow-sm px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Flow Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <h1 className="text-sm font-semibold text-slate-800 truncate">
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
          <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1">
            <Code className="w-3 h-3" />
            {processTypeLabel}
            {metadata.apiVersion && (
              <span className="text-slate-300 ml-1">
                v{metadata.apiVersion}
              </span>
            )}
          </span>
        </div>

        {/* Right: Trigger Info */}
        {(metadata.object || triggerLabel) && (
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
            {metadata.object && (
              <span className="inline-flex items-center gap-1">
                <Database className="w-3 h-3 text-slate-400" />
                <span className="font-medium text-slate-600">
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
