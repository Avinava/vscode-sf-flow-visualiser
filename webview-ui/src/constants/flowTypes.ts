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

