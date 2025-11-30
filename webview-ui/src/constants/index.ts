/**
 * Flow Visualizer Constants
 *
 * Based on Salesforce's Auto-Layout Canvas configuration:
 * - alcCanvasUtils.js: Element metadata, node types
 * - alcComponentsUtils.js: Styling, positioning
 * - alcStyles.js: CSS variables and styling constants
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
  Terminal, // Apex
  Mail, // Email
  Shuffle, // Transform
  Filter, // Collection processor
  FastForward, // Step
  MessageCircle, // Chatter
  CheckCircle, // Approval
  Globe, // External service
  MousePointer, // Quick action
} from "lucide-react";
import type { NodeConfigMap } from "../types";

// ============================================================================
// NODE DIMENSIONS
// Based on Salesforce's CSS variables from alcCanvas:
// --node-icon-width: 48px
// --node-icon-height: 48px
// --alc-element-card-width: 285px
// ============================================================================

export const NODE_WIDTH = 240; // Slightly wider to match SF better
export const NODE_HEIGHT = 56;
export const NODE_ICON_SIZE = 48;

// Element card dimensions (for card layout mode)
export const ELEMENT_CARD_WIDTH = 285;
export const ELEMENT_CARD_HEIGHT = 32;

// Paste node dimensions
export const PASTE_NODE_WIDTH = 35;
export const PASTE_NODE_HEIGHT = 35;

// ============================================================================
// GRID SPACING
// Based on Salesforce's layout configuration
// ============================================================================

export const GRID_H_GAP = 60; // Reduced horizontal gap for tighter layout
export const GRID_V_GAP = 70; // Adjusted vertical gap

// ============================================================================
// CANVAS POSITIONING
// ============================================================================

export const START_X = 800; // Canvas center X (increased for wider flows)
export const START_Y = 80; // Canvas top Y

// ============================================================================
// CONNECTOR STYLING
// Based on Salesforce's alcConnector CSS variables
// ============================================================================

export const CONNECTOR_COLORS = {
  default: "#94a3b8", // --alc-connector-stroke (slate gray)
  fault: "#ef4444", // --lwc-colorBorderError (red)
  highlight: "#60a5fa", // --lwc-paletteBlue30 (light blue)
  goto: "#3b82f6", // Blue for GoTo connectors
  cut: "#3b82f6", // --lwc-brandAccessible
  delete: "#ef4444", // --lwc-colorBorderError
};

export const CONNECTOR_WIDTHS = {
  default: 1.5, // Thinner default stroke for cleaner look
  highlight: 3, // Highlight width
};

// ============================================================================
// Z-INDEX LAYERS
// Based on Salesforce's z-index CSS variables
// ============================================================================

export const Z_INDEX = {
  connectorSvg: -1, // --z-index-alc-connector-svg
  connectorBranch: -2, // --z-index-alc-connector-branch
  connectorBranchHighlighted: -1, // --z-index-alc-connector-branch-is-highlighted
  dynamicNodeTrigger: 2, // --z-index-alc-dynamic-node-trigger
  dynamicNode: 1, // --z-index-alc-dynamic-node
  menuTriggerNode: 1, // --z-index-alc-menu-trigger-node
  dynamicNodeTriggerMenuOpened: 5, // --z-index-alc-dynamic-node-trigger-menu-opened
  dynamicNodeMenuOpened: 3, // --z-index-alc-dynamic-node-menu-opened
  selectionCheckbox: 1, // --z-index-alc-selection-checkbox
  menu: 4, // --z-index-alc-menu
  elementCard: 3, // --z-index-alc-element-card
  elementCardWithCombobox: 4, // --z-index-alc-element-card-with-combobox
  elementCardWithOpenMenu: 5, // --z-index-alc-element-card-with-open-menu
  menuTriggerOpen: 5, // --z-index-alc-menu-trigger-open
  menuTriggerContainerOpen: 4, // --z-index-alc-menu-trigger-container-open
  canvasOverlay: 99999, // --z-index-alc-canvas-overlay
};

// ============================================================================
// MENU DIMENSIONS
// ============================================================================

export const MENU_WIDTH = 300; // --alc-menu-width

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

// ============================================================================
// ELEMENT TYPES (from Salesforce flowMetadata)
// ============================================================================

export const ELEMENT_TYPE = {
  START_ELEMENT: "START_ELEMENT",
  END_ELEMENT: "END_ELEMENT",
  ROOT_ELEMENT: "ROOT_ELEMENT",
  SCREEN: "SCREEN",
  DECISION: "DECISION",
  ASSIGNMENT: "ASSIGNMENT",
  LOOP: "LOOP",
  RECORD_CREATE: "RECORD_CREATE",
  RECORD_UPDATE: "RECORD_UPDATE",
  RECORD_LOOKUP: "RECORD_LOOKUP",
  RECORD_DELETE: "RECORD_DELETE",
  ACTION_CALL: "ACTION_CALL",
  SUBFLOW: "SUBFLOW",
  WAIT: "WAIT",
  CUSTOM_ERROR: "CUSTOM_ERROR",
  GROUP: "GROUP",
  EXPERIMENT: "EXPERIMENT",
  ORCHESTRATED_STAGE: "ORCHESTRATED_STAGE",
  APEX_CALL: "APEX_CALL",
  EMAIL_ALERT: "EMAIL_ALERT",
  EXTERNAL_SERVICE: "EXTERNAL_SERVICE",
  TRIGGER_JOURNEY: "TRIGGER_JOURNEY",
  SEND_TO_MCE_EMAIL: "SEND_TO_MCE_EMAIL",
} as const;

// ============================================================================
// CONNECTOR TYPES (from Salesforce flowMetadata)
// ============================================================================

export const CONNECTOR_TYPE = {
  REGULAR: "REGULAR",
  FAULT: "FAULT",
  LOOP_NEXT: "LOOP_NEXT",
  LOOP_END: "LOOP_END",
  DEFAULT: "DEFAULT",
  IMMEDIATE: "IMMEDIATE",
  GO_TO: "GO_TO",
} as const;

// ============================================================================
// TRIGGER TYPES
// ============================================================================

export const FLOW_TRIGGER_TYPE = {
  NONE: "NONE",
  SCHEDULED: "SCHEDULED",
  PLATFORM_EVENT: "PLATFORM_EVENT",
  RECORD_AFTER_SAVE: "RecordAfterSave",
  RECORD_BEFORE_SAVE: "RecordBeforeSave",
  RECORD_BEFORE_DELETE: "RecordBeforeDelete",
  EVENT_DRIVEN_JOURNEY: "EVENT_DRIVEN_JOURNEY",
  FORM_SUBMISSION_EVENT: "FORM_SUBMISSION_EVENT",
  EXTERNAL_SYSTEM_CHANGE: "EXTERNAL_SYSTEM_CHANGE",
} as const;

// ============================================================================
// PROCESS TYPES
// ============================================================================

export const PROCESS_TYPE = {
  AUTO_LAUNCHED_FLOW: "AutolaunchedFlow",
  FLOW: "Flow",
  SCHEDULED_FLOW: "CustomEvent",
  RECORD_TRIGGERED_FLOW: "Workflow",
  PLATFORM_EVENT_FLOW: "InvocableProcess",
} as const;

export default NODE_CONFIG;
