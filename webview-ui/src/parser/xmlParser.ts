/**
 * Salesforce Flow XML Parser
 *
 * Parses Salesforce Flow XML files (*.flow-meta.xml) into a structured
 * format suitable for visualization.
 *
 * Based on Salesforce Flow metadata structure:
 * - flowMetadata.js: Element types, action types, connector types
 * - alcCanvasUtils.js: Element parsing, type detection
 */

import type {
  FlowNode,
  FlowEdge,
  ParsedFlow,
  FlowMetadata,
  NodeType,
  FlowNodeData,
} from "../types";
import { NODE_WIDTH, START_NODE_WIDTH, NODE_HEIGHT } from "../constants";
import { buildFlowRelationships } from "./buildFlowModel";

// ============================================================================
// ELEMENT TYPE MAPPING
// Based on Salesforce's ELEMENT_TYPE enum in flowMetadata
// ============================================================================

const XML_TAG_TO_NODE_TYPE: Record<string, NodeType> = {
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
  // Additional element types from Salesforce
  apexPluginCalls: "APEX_CALL",
  transforms: "TRANSFORM",
  collectionProcessors: "COLLECTION_PROCESSOR",
  steps: "STEP",
  orchestratedStages: "ORCHESTRATED_STAGE",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get text content of a child element by tag name
 */
function getText(el: Element, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent || "";
}

function getDirectChild(el: Element, tag: string): Element | undefined {
  return Array.from(el.children).find((child) => child.tagName === tag);
}

/**
 * Parse a connector element to extract target reference and GoTo flag
 */
interface ConnectorInfo {
  target: string | null;
  isGoTo: boolean;
}

function parseConnector(connectorEl: Element): ConnectorInfo {
  const target = getText(connectorEl, "targetReference") || null;
  const isGoToEl = connectorEl.getElementsByTagName("isGoTo")[0];
  const isGoTo = isGoToEl?.textContent?.toLowerCase() === "true";
  return { target, isGoTo };
}

// ============================================================================
// START ELEMENT PARSING
// ============================================================================

interface StartNodeResult {
  node: FlowNode;
  edges: FlowEdge[];
}

/**
 * Parse entry conditions from start element
 */
function parseEntryConditions(
  startEl: Element
): Array<{ field: string; operator: string; value: string }> {
  const conditions: Array<{ field: string; operator: string; value: string }> =
    [];
  const filterEls = startEl.getElementsByTagName("filters");
  for (let i = 0; i < filterEls.length; i++) {
    const filter = filterEls[i];
    const valueEl = filter.getElementsByTagName("value")[0];
    let value = "";
    if (valueEl) {
      value =
        getText(valueEl, "stringValue") ||
        getText(valueEl, "elementReference") ||
        getText(valueEl, "numberValue") ||
        getText(valueEl, "booleanValue") ||
        valueEl.textContent ||
        "";
    }
    conditions.push({
      field: getText(filter, "field"),
      operator: getText(filter, "operator"),
      value,
    });
  }
  return conditions;
}

/**
 * Parse scheduled paths from start element
 */
function parseScheduledPaths(startEl: Element): Array<{
  name: string;
  label: string;
  pathType: string;
  timeOffset?: number;
  timeOffsetUnit?: string;
}> {
  const paths: Array<{
    name: string;
    label: string;
    pathType: string;
    timeOffset?: number;
    timeOffsetUnit?: string;
  }> = [];
  const scheduledPathEls = startEl.getElementsByTagName("scheduledPaths");
  for (let i = 0; i < scheduledPathEls.length; i++) {
    const path = scheduledPathEls[i];
    const pathType = getText(path, "pathType");
    const pathName = getText(path, "name");
    let pathLabel = getText(path, "label") || pathName;
    if (!pathLabel) {
      if (pathType === "AsyncAfterCommit") {
        pathLabel = "Run Asynchronously";
      } else if (pathType === "Scheduled") {
        pathLabel = "Scheduled Path";
      } else {
        pathLabel = `Path ${i + 1}`;
      }
    }

    const timeOffsetStr = getText(path, "offsetNumber");
    const timeOffset = timeOffsetStr ? parseInt(timeOffsetStr, 10) : undefined;
    const timeOffsetUnit = getText(path, "offsetUnit") || undefined;

    paths.push({
      name: pathName,
      label: pathLabel,
      pathType,
      timeOffset,
      timeOffsetUnit,
    });
  }
  return paths;
}

function parseStartElement(startEl: Element): StartNodeResult {
  const edges: FlowEdge[] = [];

  const triggerType = getText(startEl, "triggerType");
  const obj = getText(startEl, "object");
  const recTrigger = getText(startEl, "recordTriggerType");

  // Parse additional entry criteria fields
  const filterFormula = getText(startEl, "filterFormula");
  const filterLogic = getText(startEl, "filterLogic");
  const doesRequireRecordChangedToMeetCriteria = getText(
    startEl,
    "doesRequireRecordChangedToMeetCriteria"
  );
  const entryConditions = parseEntryConditions(startEl);
  const scheduledPathsData = parseScheduledPaths(startEl);

  // Parse schedule info for scheduled flows
  const schedule = getText(startEl, "schedule");
  const frequency = getText(startEl, "frequency");

  // Determine start label based on trigger type
  let startLabel = "Start";
  if (triggerType === "RecordAfterSave" || triggerType === "RecordBeforeSave") {
    startLabel = "Record-Triggered Flow";
  } else if (triggerType === "Scheduled") {
    startLabel = "Scheduled Flow";
  } else if (triggerType === "PlatformEvent") {
    startLabel = "Platform Event-Triggered Flow";
  }

  // Calculate height based on trigger info (for expanded panel)
  // Base height (56) + trigger panel rows
  let startHeight = NODE_HEIGHT;
  const hasTriggerInfo = obj || triggerType || recTrigger;
  if (hasTriggerInfo) {
    // Each info row is ~24px, plus padding
    startHeight = 140; // Fixed height for START with trigger info
  }

  const node: FlowNode = {
    id: "START_NODE",
    type: "START",
    label: startLabel,
    x: 0,
    y: 0,
    width: START_NODE_WIDTH,
    height: startHeight,
    data: {
      object: obj,
      triggerType,
      recordTriggerType: recTrigger,
      // Entry criteria
      filterFormula,
      filterLogic,
      doesRequireRecordChangedToMeetCriteria:
        doesRequireRecordChangedToMeetCriteria === "true",
      entryConditions: entryConditions.length > 0 ? entryConditions : undefined,
      // Scheduled paths
      scheduledPaths:
        scheduledPathsData.length > 0 ? scheduledPathsData : undefined,
      // Schedule info
      schedule,
      frequency,
    },
  };

  // Parse scheduled paths first to determine if we need "Run Immediately" label
  const scheduledPaths = startEl.getElementsByTagName("scheduledPaths");
  const hasScheduledPaths = scheduledPaths.length > 0;

  // Parse main connector
  const connEl = getDirectChild(startEl, "connector");
  if (connEl) {
    const { target, isGoTo } = parseConnector(connEl);
    if (target) {
      edges.push({
        id: `start-${target}`,
        source: "START_NODE",
        target,
        // Add "Run Immediately" label when there are scheduled paths (like SF does)
        label: hasScheduledPaths ? "Run Immediately" : undefined,
        type: isGoTo ? "goto" : "normal",
        isGoTo,
      });
    }
  } else if (hasScheduledPaths) {
    // No immediate path connector - create implicit END for "Run Immediately"
    edges.push({
      id: "start-immediate-end",
      source: "START_NODE",
      target: "START_IMMEDIATE_END",
      label: "Run Immediately",
      type: "normal",
    });
  }

  // Parse scheduled paths (for record-triggered flows with async paths)
  for (let i = 0; i < scheduledPaths.length; i++) {
    const path = scheduledPaths[i];
    const pathType = getText(path, "pathType");
    const pathName = getText(path, "name");

    // Determine label based on pathType (following Salesforce's naming)
    let pathLabel = getText(path, "label") || pathName;
    if (!pathLabel) {
      if (pathType === "AsyncAfterCommit") {
        pathLabel = "Run Asynchronously";
      } else if (pathType === "Scheduled") {
        pathLabel = "Scheduled Path";
      } else {
        pathLabel = `Path ${i + 1}`;
      }
    }

    const pathConn = path.getElementsByTagName("connector")[0];
    if (pathConn) {
      const { target, isGoTo } = parseConnector(pathConn);
      if (target) {
        edges.push({
          id: `start-${target}-sched-${i}`,
          source: "START_NODE",
          target,
          label: pathLabel,
          type: isGoTo ? "goto" : "normal",
          isGoTo,
        });
      }
    }
  }

  return { node, edges };
}

// ============================================================================
// FLOW ELEMENT PARSING
// ============================================================================

interface ElementResult {
  node: FlowNode;
  edges: FlowEdge[];
}

/**
 * Extract assignment items from an assignment element
 */
function parseAssignmentItems(
  el: Element
): Array<{ field: string; operator: string; value: string }> {
  const items: Array<{ field: string; operator: string; value: string }> = [];
  const assignmentItems = el.getElementsByTagName("assignmentItems");
  for (let i = 0; i < assignmentItems.length; i++) {
    const item = assignmentItems[i];
    items.push({
      field: getText(item, "assignToReference"),
      operator: getText(item, "operator"),
      value:
        getText(item, "value") ||
        getText(item, "stringValue") ||
        getText(item, "elementReference") ||
        "",
    });
  }
  return items;
}

/**
 * Extract input assignments from a record element
 */
function parseInputAssignments(
  el: Element
): Array<{ field: string; value: string }> {
  const inputs: Array<{ field: string; value: string }> = [];
  const inputAssignments = el.getElementsByTagName("inputAssignments");
  for (let i = 0; i < inputAssignments.length; i++) {
    const item = inputAssignments[i];
    const valueEl = item.getElementsByTagName("value")[0];
    let value = "";
    if (valueEl) {
      // Try different value types
      value =
        getText(valueEl, "stringValue") ||
        getText(valueEl, "elementReference") ||
        getText(valueEl, "numberValue") ||
        getText(valueEl, "booleanValue") ||
        valueEl.textContent ||
        "";
    }
    inputs.push({
      field: getText(item, "field"),
      value,
    });
  }
  return inputs;
}

/**
 * Extract filters/conditions from a record lookup
 */
function parseFilters(
  el: Element
): Array<{ field: string; operator: string; value: string }> {
  const filters: Array<{ field: string; operator: string; value: string }> = [];
  const filterEls = el.getElementsByTagName("filters");
  for (let i = 0; i < filterEls.length; i++) {
    const filter = filterEls[i];
    const valueEl = filter.getElementsByTagName("value")[0];
    let value = "";
    if (valueEl) {
      value =
        getText(valueEl, "stringValue") ||
        getText(valueEl, "elementReference") ||
        getText(valueEl, "numberValue") ||
        valueEl.textContent ||
        "";
    }
    filters.push({
      field: getText(filter, "field"),
      operator: getText(filter, "operator"),
      value,
    });
  }
  return filters;
}

/**
 * Extract conditions from a decision rule
 */
function parseConditions(
  ruleEl: Element
): Array<{ field: string; operator: string; value: string }> {
  const conditions: Array<{ field: string; operator: string; value: string }> =
    [];
  const conditionEls = ruleEl.getElementsByTagName("conditions");
  for (let i = 0; i < conditionEls.length; i++) {
    const cond = conditionEls[i];
    const rightValueEl = cond.getElementsByTagName("rightValue")[0];
    let value = "";
    if (rightValueEl) {
      value =
        getText(rightValueEl, "stringValue") ||
        getText(rightValueEl, "elementReference") ||
        getText(rightValueEl, "numberValue") ||
        getText(rightValueEl, "booleanValue") ||
        rightValueEl.textContent ||
        "";
    }
    conditions.push({
      field: getText(cond, "leftValueReference"),
      operator: getText(cond, "operator"),
      value,
    });
  }
  return conditions;
}

/**
 * Extract screen fields information
 */
function parseScreenFields(
  el: Element
): Array<{ name: string; type: string; label: string; required: boolean }> {
  const fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
  }> = [];
  const fieldEls = el.getElementsByTagName("fields");
  for (let i = 0; i < fieldEls.length; i++) {
    const field = fieldEls[i];
    fields.push({
      name: getText(field, "name"),
      type: getText(field, "fieldType"),
      label: getText(field, "fieldText") || getText(field, "name"),
      required: getText(field, "isRequired").toLowerCase() === "true",
    });
  }
  return fields;
}

function parseFlowElement(el: Element, type: NodeType): ElementResult {
  const edges: FlowEdge[] = [];

  const name = getText(el, "name");
  const label = getText(el, "label") || name;
  const obj = getText(el, "object");
  const description = getText(el, "description");

  // Extract type-specific data
  const elementData: FlowNodeData = {
    xmlElement: el.outerHTML,
    object: obj,
    description,
  };

  // Parse assignment items
  if (type === "ASSIGNMENT") {
    elementData.assignmentItems = parseAssignmentItems(el);
  }

  // Parse record operations
  if (type === "RECORD_CREATE" || type === "RECORD_UPDATE") {
    elementData.inputAssignments = parseInputAssignments(el);
    elementData.inputReference = getText(el, "inputReference");
    elementData.storeOutputAutomatically =
      getText(el, "storeOutputAutomatically").toLowerCase() === "true";
  }

  // Parse record lookup
  if (type === "RECORD_LOOKUP") {
    elementData.filters = parseFilters(el);
    elementData.filterLogic = getText(el, "filterLogic");
    elementData.getFirstRecordOnly =
      getText(el, "getFirstRecordOnly").toLowerCase() === "true";
    elementData.storeOutputAutomatically =
      getText(el, "storeOutputAutomatically").toLowerCase() === "true";
    elementData.sortField = getText(el, "sortField");
    elementData.sortOrder = getText(el, "sortOrder");
  }

  // Parse record delete
  if (type === "RECORD_DELETE") {
    elementData.filters = parseFilters(el);
    elementData.filterLogic = getText(el, "filterLogic");
    elementData.inputReference = getText(el, "inputReference");
  }

  // Parse loop
  if (type === "LOOP") {
    elementData.collectionReference = getText(el, "collectionReference");
    elementData.iterationOrder = getText(el, "iterationOrder");
    elementData.assignNextValueToReference = getText(
      el,
      "assignNextValueToReference"
    );
  }

  // Parse screen fields
  if (type === "SCREEN") {
    elementData.screenFields = parseScreenFields(el);
    elementData.allowBack = getText(el, "allowBack").toLowerCase() === "true";
    elementData.allowFinish =
      getText(el, "allowFinish").toLowerCase() === "true";
    elementData.allowPause = getText(el, "allowPause").toLowerCase() === "true";
    elementData.showHeader = getText(el, "showHeader").toLowerCase() === "true";
    elementData.showFooter = getText(el, "showFooter").toLowerCase() === "true";
  }

  // Parse subflow
  if (type === "SUBFLOW") {
    elementData.flowName = getText(el, "flowName");
    elementData.inputAssignments = parseInputAssignments(el);
  }

  // Parse action call - detect specific action types
  if (type === "ACTION") {
    elementData.actionName = getText(el, "actionName");
    elementData.actionType = getText(el, "actionType");
    elementData.inputAssignments = parseInputAssignments(el);
  }

  // Refine node type based on actionType for ACTION elements
  let finalType = type;
  if (type === "ACTION" && elementData.actionType) {
    const actionTypeMap: Record<string, NodeType> = {
      emailAlert: "EMAIL_ALERT",
      quickAction: "QUICK_ACTION",
      apex: "APEX_CALL",
      submit: "SUBMIT_FOR_APPROVAL",
      externalService: "EXTERNAL_SERVICE",
      chatterPost: "POST_TO_CHATTER",
      sendEmail: "SEND_EMAIL",
    };
    finalType = actionTypeMap[elementData.actionType as string] || type;
  }

  // Parse decision rules (for data display, not connectors)
  if (type === "DECISION") {
    const rulesEls = el.getElementsByTagName("rules");
    const rulesData: Array<{
      name: string;
      label: string;
      conditionLogic: string;
      conditions: Array<{ field: string; operator: string; value: string }>;
    }> = [];
    for (let j = 0; j < rulesEls.length; j++) {
      const rule = rulesEls[j];
      rulesData.push({
        name: getText(rule, "name"),
        label: getText(rule, "label") || getText(rule, "name"),
        conditionLogic: getText(rule, "conditionLogic"),
        conditions: parseConditions(rule),
      });
    }
    elementData.rules = rulesData;
    elementData.defaultConnectorLabel =
      getText(el, "defaultConnectorLabel") || "Default Outcome";
  }

  const node: FlowNode = {
    id: name,
    type: finalType,
    label,
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: elementData,
  };

  // Parse standard connector
  for (const child of Array.from(el.children)) {
    if (child.tagName === "connector") {
      const { target, isGoTo } = parseConnector(child);
      if (target) {
        edges.push({
          id: `${name}-${target}`,
          source: name,
          target,
          type: isGoTo ? "goto" : "normal",
          isGoTo,
        });
      }
    }
  }

  // Parse fault connector
  const faultConn = el.getElementsByTagName("faultConnector")[0];
  if (faultConn) {
    const { target, isGoTo } = parseConnector(faultConn);
    if (target) {
      edges.push({
        id: `${name}-${target}-fault`,
        source: name,
        target,
        label: "Fault",
        type: "fault",
        isGoTo,
        isFault: true,
      });
    }
  }

  // Parse decision rules
  if (type === "DECISION") {
    const rules = el.getElementsByTagName("rules");
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      const ruleLabel = getText(rule, "label") || getText(rule, "name");
      for (const rc of Array.from(rule.children)) {
        if (rc.tagName === "connector") {
          const { target, isGoTo } = parseConnector(rc);
          if (target) {
            edges.push({
              id: `${name}-${target}-rule-${j}`,
              source: name,
              target,
              label: ruleLabel,
              type: isGoTo ? "goto" : "normal",
              isGoTo,
            });
          }
        }
      }
    }

    // Parse default connector
    const defConn = el.getElementsByTagName("defaultConnector")[0];
    const defLabel = getText(el, "defaultConnectorLabel") || "Default Outcome";

    if (defConn) {
      const { target, isGoTo } = parseConnector(defConn);
      if (target) {
        edges.push({
          id: `${name}-${target}-def`,
          source: name,
          target,
          label: defLabel,
          type: isGoTo ? "goto" : "normal",
          isGoTo,
        });
      }
    } else if (defLabel) {
      // No default connector but has a label - this means default goes to implicit End
      // We'll mark this node as having an implicit end on default path
      node.data.hasImplicitDefaultEnd = true;
      node.data.defaultConnectorLabel = defLabel;
    }
  }

  // Parse loop connectors
  if (type === "LOOP") {
    const nextConn = el.getElementsByTagName("nextValueConnector")[0];
    if (nextConn) {
      const { target, isGoTo } = parseConnector(nextConn);
      if (target) {
        edges.push({
          id: `${name}-${target}-next`,
          source: name,
          target,
          label: "For Each",
          type: "loop-next",
          isGoTo,
        });
      }
    }

    const endConn = el.getElementsByTagName("noMoreValuesConnector")[0];
    if (endConn) {
      const { target, isGoTo } = parseConnector(endConn);
      if (target) {
        edges.push({
          id: `${name}-${target}-end`,
          source: name,
          target,
          label: "After Last",
          type: "loop-end",
          isGoTo,
        });
      }
    }
  }

  // Parse wait events
  if (type === "WAIT") {
    const waitEvents = el.getElementsByTagName("waitEvents");
    for (let j = 0; j < waitEvents.length; j++) {
      const we = waitEvents[j];
      const weLabel = getText(we, "label") || getText(we, "name");
      const weConn = we.getElementsByTagName("connector")[0];
      if (weConn) {
        const { target, isGoTo } = parseConnector(weConn);
        if (target) {
          edges.push({
            id: `${name}-${target}-wait-${j}`,
            source: name,
            target,
            label: weLabel,
            type: isGoTo ? "goto" : "normal",
            isGoTo,
          });
        }
      }
    }

    // Parse default connector for waits
    const defConn = el.getElementsByTagName("defaultConnector")[0];
    if (defConn) {
      const { target, isGoTo } = parseConnector(defConn);
      const defLabel = getText(el, "defaultConnectorLabel") || "Default";
      if (target) {
        edges.push({
          id: `${name}-${target}-def`,
          source: name,
          target,
          label: defLabel,
          type: isGoTo ? "goto" : "normal",
          isGoTo,
        });
      }
    }
  }

  return { node, edges };
}

// ============================================================================
// END NODE GENERATION
// Based on Salesforce's handling of terminal nodes
// ============================================================================

function generateEndNodes(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const resultNodes = [...nodes];
  const resultEdges = [...edges];

  // Track nodes that have at least one non-fault outgoing connector
  const nodesWithRegularOutgoing = new Set<string>();
  // Track nodes reached via (or continuing along) fault paths
  const faultReachedNodes = new Set<string>();
  const incomingEdges = new Map<string, FlowEdge[]>();

  edges.forEach((edge) => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge);

    if (edge.type !== "fault" && edge.type !== "fault-end") {
      nodesWithRegularOutgoing.add(edge.source);
    }

    if (edge.type === "fault" || edge.type === "fault-end") {
      faultReachedNodes.add(edge.target);
    }
  });

  // Nodes whose only incoming connectors are faults should inherit fault styling
  // But nodes with ANY normal incoming connector are part of the main flow
  incomingEdges.forEach((incoming, nodeId) => {
    const hasNormalIncoming = incoming.some(
      (edge) => edge.type !== "fault" && edge.type !== "fault-end"
    );
    if (hasNormalIncoming) {
      // This node is reachable via normal path, remove from fault set
      faultReachedNodes.delete(nodeId);
    } else if (
      incoming.length > 0 &&
      incoming.every(
        (edge) => edge.type === "fault" || edge.type === "fault-end"
      )
    ) {
      faultReachedNodes.add(nodeId);
    }
  });

  let endNodeCount = 0;

  // Handle START node with immediate end (when there are scheduled paths but no immediate connector)
  const startImmediateEndEdge = edges.find(
    (e) => e.target === "START_IMMEDIATE_END"
  );
  if (startImmediateEndEdge) {
    resultNodes.push({
      id: "START_IMMEDIATE_END",
      type: "END",
      label: "End",
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: 40,
      data: { isFaultPath: false },
    });
    // Edge already exists in edges array
  }

  // Handle Decision nodes with implicit default End (no defaultConnector but has defaultConnectorLabel)
  nodes.forEach((node) => {
    if (node.type === "DECISION" && node.data.hasImplicitDefaultEnd) {
      const endNodeId = `END_NODE_${endNodeCount++}`;
      const defLabel =
        (node.data.defaultConnectorLabel as string) || "Default Outcome";

      resultNodes.push({
        id: endNodeId,
        type: "END",
        label: "End",
        x: 0,
        y: 0,
        width: NODE_WIDTH,
        height: 40,
        data: { isFaultPath: false },
      });

      resultEdges.push({
        id: `${node.id}-${endNodeId}-def`,
        source: node.id,
        target: endNodeId,
        label: defLabel,
        type: "normal",
      });
    }
  });

  // Find terminal nodes (no outgoing edges, not START)
  const terminalNodes = nodes.filter(
    (node) => !nodesWithRegularOutgoing.has(node.id) && node.type !== "START"
  );

  terminalNodes.forEach((node) => {
    const endNodeId = `END_NODE_${endNodeCount++}`;
    const isFaultPath = faultReachedNodes.has(node.id);

    resultNodes.push({
      id: endNodeId,
      type: "END",
      label: "End",
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: 40,
      data: { isFaultPath },
    });

    resultEdges.push({
      id: `${node.id}-${endNodeId}`,
      source: node.id,
      target: endNodeId,
      type: isFaultPath ? "fault-end" : "normal",
    });
  });

  return { nodes: resultNodes, edges: resultEdges };
}

// ============================================================================
// METADATA PARSING
// Based on Salesforce Flow metadata XML schema
// ============================================================================

function parseMetadata(flowEl: Element, startEl: Element | null): FlowMetadata {
  const metadata: FlowMetadata = {};

  for (const child of Array.from(flowEl.children)) {
    switch (child.tagName) {
      case "label":
        metadata.label = child.textContent || "";
        break;
      case "apiVersion":
        metadata.apiVersion = child.textContent || "";
        break;
      case "processType":
        metadata.processType = child.textContent || "";
        break;
      case "description":
        metadata.description = child.textContent || "";
        break;
      case "status":
        metadata.status = child.textContent || "";
        break;
      case "environments":
        metadata.environments = child.textContent || "";
        break;
      case "interviewLabel":
        metadata.interviewLabel = child.textContent || "";
        break;
      case "runInMode":
        metadata.runInMode = child.textContent || "";
        break;
    }
  }

  // Extract trigger info from start element
  if (startEl) {
    const triggerType = getText(startEl, "triggerType");
    const object = getText(startEl, "object");
    const recordTriggerType = getText(startEl, "recordTriggerType");

    if (triggerType) metadata.triggerType = triggerType;
    if (object) metadata.object = object;
    if (recordTriggerType) metadata.recordTriggerType = recordTriggerType;
  }

  return metadata;
}

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse a Salesforce Flow XML document into a structured format
 *
 * @param xmlText - The raw XML content of a .flow-meta.xml file
 * @returns Parsed flow with nodes, edges, and metadata
 */
export function parseFlowXML(xmlText: string): ParsedFlow {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  let nodes: FlowNode[] = [];
  let edges: FlowEdge[] = [];
  let metadata: FlowMetadata = {};

  // Parse start element first
  const startEl = doc.getElementsByTagName("start")[0];

  // Parse flow metadata (needs start element for trigger info)
  const flowEl = doc.getElementsByTagName("Flow")[0];
  if (flowEl) {
    metadata = parseMetadata(flowEl, startEl || null);
  }

  // Parse start element
  if (startEl) {
    const { node, edges: startEdges } = parseStartElement(startEl);
    // Add flow description to START node for display in sidebar
    if (metadata.description) {
      node.data.description = metadata.description;
    }
    nodes.push(node);
    edges.push(...startEdges);
  }

  // Parse all flow elements
  for (const [tag, type] of Object.entries(XML_TAG_TO_NODE_TYPE)) {
    const elements = doc.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const { node, edges: elementEdges } = parseFlowElement(el, type);
      nodes.push(node);
      edges.push(...elementEdges);
    }
  }

  // Generate END nodes for terminal paths
  const { nodes: finalNodes, edges: finalEdges } = generateEndNodes(
    nodes,
    edges
  );

  const normalizedNodes = buildFlowRelationships(finalNodes, finalEdges);

  return {
    nodes: normalizedNodes,
    edges: finalEdges,
    metadata,
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that the XML is a valid Salesforce Flow
 */
export function isValidFlowXML(xmlText: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    // Check for parse errors
    const parseError = doc.getElementsByTagName("parsererror");
    if (parseError.length > 0) return false;

    // Check for Flow root element
    const flowEl = doc.getElementsByTagName("Flow")[0];
    if (!flowEl) return false;

    // Check for start element
    const startEl = doc.getElementsByTagName("start")[0];
    if (!startEl) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Get flow label from XML (quick extraction without full parsing)
 */
export function getFlowLabel(xmlText: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    const labelEl = doc.getElementsByTagName("label")[0];
    return labelEl?.textContent || null;
  } catch {
    return null;
  }
}

export default parseFlowXML;
