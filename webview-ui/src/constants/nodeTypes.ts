/**
 * Node Type Configuration
 *
 * Visual configuration for each node type based on Salesforce's
 * elementsMetadata and iconography from alcCanvasUtils.js
 */

import {
  Play,
  Monitor,
  GitBranch,
  CheckSquare,
  Repeat,
  Database,
  Edit3,
  Search,
  Zap,
  Code,
  Clock,
  AlertTriangle,
  Circle,
  Terminal,
  Mail,
  Shuffle,
  Filter,
  FastForward,
  MessageCircle,
  CheckCircle,
  Globe,
  MousePointer,
} from "lucide-react";
import type { NodeConfigMap } from "../types";

// ============================================================================
// NODE TYPE CONFIGURATION
// Visual configuration for each node type
// Based on Salesforce's elementsMetadata and iconography
// ============================================================================

export const NODE_CONFIG: NodeConfigMap = {
  START: {
    color: "#22c55e", // Green
    icon: Play,
    label: "Start",
    iconShape: "circle",
  },
  SCREEN: {
    color: "#3b82f6", // Blue
    icon: Monitor,
    label: "Screen",
    iconShape: "circle",
  },
  DECISION: {
    color: "#f59e0b", // Amber/Orange
    icon: GitBranch,
    label: "Decision",
    iconShape: "diamond",
  },
  ASSIGNMENT: {
    color: "#f97316", // Orange
    icon: CheckSquare,
    label: "Assignment",
    iconShape: "circle",
  },
  LOOP: {
    color: "#ec4899", // Pink
    icon: Repeat,
    label: "Loop",
    iconShape: "circle",
  },
  RECORD_CREATE: {
    color: "#ef4444", // Red
    icon: Database,
    label: "Create Records",
    iconShape: "circle",
  },
  RECORD_UPDATE: {
    color: "#f59e0b", // Amber
    icon: Edit3,
    label: "Update Records",
    iconShape: "circle",
  },
  RECORD_LOOKUP: {
    color: "#ef4444", // Red
    icon: Search,
    label: "Get Records",
    iconShape: "circle",
  },
  RECORD_DELETE: {
    color: "#dc2626", // Dark Red
    icon: Database,
    label: "Delete Records",
    iconShape: "circle",
  },
  ACTION: {
    color: "#06b6d4", // Cyan
    icon: Zap,
    label: "Action",
    iconShape: "circle",
  },
  SUBFLOW: {
    color: "#8b5cf6", // Purple
    icon: Code,
    label: "Subflow",
    iconShape: "circle",
  },
  WAIT: {
    color: "#eab308", // Yellow
    icon: Clock,
    label: "Wait",
    iconShape: "diamond",
  },
  CUSTOM_ERROR: {
    color: "#dc2626", // Dark Red
    icon: AlertTriangle,
    label: "Custom Error",
    iconShape: "circle",
  },
  END: {
    color: "#ef4444", // Red
    icon: Circle,
    label: "End",
    iconShape: "circle",
  },
  // Internal types
  ROOT: {
    color: "#64748b", // Slate
    icon: Circle,
    label: "Root",
    iconShape: "circle",
  },
  BRANCH: {
    color: "#64748b", // Slate
    icon: GitBranch,
    label: "Branch",
    iconShape: "diamond",
  },
  GROUP: {
    color: "#64748b", // Slate
    icon: Circle,
    label: "Group",
    iconShape: "square",
  },
  ORCHESTRATED_STAGE: {
    color: "#8b5cf6", // Purple
    icon: Circle,
    label: "Orchestrated Stage",
    iconShape: "circle",
  },
  // Additional element types
  APEX_CALL: {
    color: "#8b5cf6", // Purple (code-related)
    icon: Terminal,
    label: "Apex Action",
    iconShape: "circle",
  },
  EMAIL_ALERT: {
    color: "#06b6d4", // Cyan
    icon: Mail,
    label: "Email Alert",
    iconShape: "circle",
  },
  TRANSFORM: {
    color: "#10b981", // Emerald
    icon: Shuffle,
    label: "Transform",
    iconShape: "circle",
  },
  COLLECTION_PROCESSOR: {
    color: "#f59e0b", // Amber
    icon: Filter,
    label: "Collection Processor",
    iconShape: "circle",
  },
  STEP: {
    color: "#8b5cf6", // Purple
    icon: FastForward,
    label: "Step",
    iconShape: "circle",
  },
  SEND_EMAIL: {
    color: "#06b6d4", // Cyan
    icon: Mail,
    label: "Send Email",
    iconShape: "circle",
  },
  POST_TO_CHATTER: {
    color: "#3b82f6", // Blue
    icon: MessageCircle,
    label: "Post to Chatter",
    iconShape: "circle",
  },
  SUBMIT_FOR_APPROVAL: {
    color: "#22c55e", // Green
    icon: CheckCircle,
    label: "Submit for Approval",
    iconShape: "circle",
  },
  CREATE_APPROVAL_REQUEST: {
    color: "#22c55e", // Green
    icon: CheckCircle,
    label: "Create Approval Request",
    iconShape: "circle",
  },
  EXTERNAL_SERVICE: {
    color: "#6366f1", // Indigo
    icon: Globe,
    label: "External Service",
    iconShape: "circle",
  },
  QUICK_ACTION: {
    color: "#f97316", // Orange
    icon: MousePointer,
    label: "Quick Action",
    iconShape: "circle",
  },
};

export default NODE_CONFIG;
