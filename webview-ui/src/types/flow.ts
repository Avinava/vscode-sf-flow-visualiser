/**
 * Flow Types and Interfaces
 * Based on Salesforce Auto-Layout Canvas patterns
 */

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Node types supported in Salesforce Flows
 * Matches Salesforce's NodeType enum from autoLayoutCanvas
 */
export type NodeType =
  | "START"
  | "SCREEN"
  | "DECISION"
  | "ASSIGNMENT"
  | "LOOP"
  | "RECORD_CREATE"
  | "RECORD_UPDATE"
  | "RECORD_LOOKUP"
  | "RECORD_DELETE"
  | "ACTION"
  | "SUBFLOW"
  | "WAIT"
  | "CUSTOM_ERROR"
  | "END"
  | "ROOT" // Salesforce internal - parent of START
  | "BRANCH" // Salesforce internal - branching node
  | "GROUP" // Salesforce internal - grouping container
  | "ORCHESTRATED_STAGE" // Salesforce orchestration
  // Additional element types from Salesforce
  | "APEX_CALL" // Apex Action
  | "EMAIL_ALERT" // Email Alert
  | "TRANSFORM" // Transform element
  | "COLLECTION_PROCESSOR" // Collection processors (sort, filter, etc.)
  | "STEP" // Orchestrated step
  | "SEND_EMAIL" // Simple email action
  | "POST_TO_CHATTER" // Chatter post action
  | "SUBMIT_FOR_APPROVAL" // Approval submission
  | "CREATE_APPROVAL_REQUEST" // Approval request creation
  | "EXTERNAL_SERVICE" // External service call
  | "QUICK_ACTION"; // Quick action

/**
 * Connector/Edge types following Salesforce patterns
 */
export type EdgeType =
  | "normal"
  | "fault"
  | "loop-next" // For Each path in loops
  | "loop-end" // After Last path in loops
  | "fault-end" // Fault path that leads to END
  | "goto"; // GoTo connector (dashed in SF)


/**
 * Geometry type for positioning - matches Salesforce pattern
 */
export interface Geometry {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * Point type for coordinates
 */
export interface Point {
  x: number;
  y: number;
}

// ============================================================================
// FLOW NODE
// ============================================================================

/**
 * Configuration state for a node
 */
export interface NodeConfig {
  isSelected: boolean;
  isHighlighted: boolean;
  isSelectable: boolean;
  hasDebugError: boolean;
  hasError: boolean;
  hasWarning?: boolean;
  isCollapsed?: boolean;
}

/**
 * Flow node - represents a single element in the flow
 */
export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: FlowNodeData;
  config?: NodeConfig;
  // Layout relationships (from Salesforce alcCanvasUtils)
  next?: string; // Next node ID
  prev?: string; // Previous node ID
  parent?: string; // Parent node ID (for branch children)
  childIndex?: number; // Index within parent's children
  children?: (string | null)[]; // Child node IDs (for branching nodes)
  fault?: string; // Fault path node ID
  incomingGoTo?: string[]; // IDs of nodes with GoTo connectors pointing here
  isTerminal?: boolean; // Whether this is a terminal node
}

/**
 * Extended data stored on flow nodes
 */
export interface FlowNodeData {
  xmlElement?: string;
  object?: string;
  triggerType?: string;
  recordTriggerType?: string;
  isFaultPath?: boolean;
  description?: string;

  // Start node / Entry criteria data
  filterFormula?: string;
  filterLogic?: string;
  doesRequireRecordChangedToMeetCriteria?: boolean;
  entryConditions?: Array<{ field: string; operator: string; value: string }>;
  scheduledPaths?: Array<{
    name: string;
    label: string;
    pathType: string;
    timeOffset?: number;
    timeOffsetUnit?: string;
  }>;
  schedule?: string;
  frequency?: string;

  // Assignment data
  assignmentItems?: Array<{ field: string; operator: string; value: string }>;

  // Record operation data
  inputAssignments?: Array<{ field: string; value: string }>;
  inputReference?: string;
  storeOutputAutomatically?: boolean;

  // Record lookup data
  filters?: Array<{ field: string; operator: string; value: string }>;
  getFirstRecordOnly?: boolean;
  sortField?: string;
  sortOrder?: string;

  // Decision data
  rules?: Array<{
    name: string;
    label: string;
    conditionLogic: string;
    conditions: Array<{ field: string; operator: string; value: string }>;
  }>;
  defaultConnectorLabel?: string;
  hasImplicitDefaultEnd?: boolean;

  // Loop data
  collectionReference?: string;
  iterationOrder?: string;
  assignNextValueToReference?: string;

  // Screen data
  screenFields?: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
  }>;
  allowBack?: boolean;
  allowFinish?: boolean;
  allowPause?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;

  // Subflow data
  flowName?: string;

  // Action data
  actionName?: string;
  actionType?: string;

  // Allow additional properties
  [key: string]: unknown;
}

// ============================================================================
// FLOW EDGE / CONNECTOR
// ============================================================================

/**
 * Flow edge/connector - represents a connection between nodes
 * Based on Salesforce's connector patterns from alcConnector
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: EdgeType;
  // Extended properties from Salesforce
  childSource?: string; // Reference to child for decision branches
  labelType?: string;
  isGoTo?: boolean;
  isFault?: boolean;
  isHighlighted?: boolean;
  operationType?: "delete" | "cut";
}


/**
 * Layout configuration - based on Salesforce's getDefaultLayoutConfig
 */
export interface LayoutConfig {
  node: {
    icon: {
      w: number;
      h: number;
    };
    width: number;
    height: number;
  };
  connector: {
    icon: {
      w: number;
    };
  };
  grid: {
    hGap: number;
    vGap: number;
  };
  start: {
    x: number;
    y: number;
  };
}

// ============================================================================
// PARSED FLOW
// ============================================================================

/**
 * Flow metadata - comprehensive metadata from XML
 */
export interface FlowMetadata {
  label?: string;
  apiVersion?: string;
  processType?: string;
  triggerType?: string;
  object?: string;
  description?: string;
  status?: string;
  environments?: string;
  interviewLabel?: string;
  runInMode?: string;
  recordTriggerType?: string;
}

/**
 * Parsed flow result
 */
export interface ParsedFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: FlowMetadata;
  xmlContent?: string; // Full flow XML content for quality analysis
}

// ============================================================================
// NODE CONFIGURATION
// ============================================================================

/**
 * Visual configuration for each node type
 */
export interface NodeTypeConfig {
  color: string;
  icon: React.ElementType;
  label: string;
  iconShape?: "circle" | "diamond" | "square";
  iconSize?: "small" | "medium" | "large";
  iconBackgroundColor?: string;
}

/**
 * Map of node types to their visual configuration
 */
export type NodeConfigMap = Record<NodeType, NodeTypeConfig>;
