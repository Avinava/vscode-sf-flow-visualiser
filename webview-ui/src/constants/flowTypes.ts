/**
 * Flow Element Type Constants
 *
 * Based on Salesforce's flowMetadata definitions from alcCanvasUtils.js
 */

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

export type ElementType = (typeof ELEMENT_TYPE)[keyof typeof ELEMENT_TYPE];

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

export type ConnectorType =
  (typeof CONNECTOR_TYPE)[keyof typeof CONNECTOR_TYPE];

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

export type FlowTriggerType =
  (typeof FLOW_TRIGGER_TYPE)[keyof typeof FLOW_TRIGGER_TYPE];

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

export type ProcessType = (typeof PROCESS_TYPE)[keyof typeof PROCESS_TYPE];

// ============================================================================
// XML TAG TO NODE TYPE MAPPING
// Maps flow XML element tags to internal node types
// ============================================================================

export const XML_TAG_TO_NODE_TYPE: Record<string, string> = {
  screens: "SCREEN",
  decisions: "DECISION",
  assignments: "ASSIGNMENT",
  loops: "LOOP",
  recordCreates: "RECORD_CREATE",
  recordUpdates: "RECORD_UPDATE",
  recordLookups: "RECORD_LOOKUP",
  recordDeletes: "RECORD_DELETE",
  actionCalls: "ACTION",
  subflows: "SUBFLOW",
  waits: "WAIT",
  customErrors: "CUSTOM_ERROR",
  apexPluginCalls: "APEX_CALL",
  transforms: "TRANSFORM",
  collectionProcessors: "COLLECTION_PROCESSOR",
  steps: "STEP",
  orchestratedStages: "ORCHESTRATED_STAGE",
} as const;

// ============================================================================
// BRANCHING NODE TYPES
// Node types that create multiple branches
// ============================================================================

export const BRANCHING_NODE_TYPES = ["DECISION", "WAIT", "LOOP"] as const;

// ============================================================================
// RECORD OPERATION NODE TYPES
// Node types that interact with Salesforce records
// ============================================================================

export const RECORD_NODE_TYPES = [
  "RECORD_CREATE",
  "RECORD_UPDATE",
  "RECORD_LOOKUP",
  "RECORD_DELETE",
] as const;
