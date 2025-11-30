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
} from "../types";
import { NODE_WIDTH, NODE_HEIGHT } from "../constants";

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

function parseStartElement(startEl: Element): StartNodeResult {
  const edges: FlowEdge[] = [];

  const triggerType = getText(startEl, "triggerType");
  const obj = getText(startEl, "object");
  const recTrigger = getText(startEl, "recordTriggerType");

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
    width: NODE_WIDTH,
    height: startHeight,
    data: {
      object: obj,
      triggerType,
      recordTriggerType: recTrigger,
    },
  };

  // Parse scheduled paths first to determine if we need "Run Immediately" label
  const scheduledPaths = startEl.getElementsByTagName("scheduledPaths");
  const hasScheduledPaths = scheduledPaths.length > 0;

  // Parse main connector
  const connEl = startEl.getElementsByTagName("connector")[0];
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

function parseFlowElement(el: Element, type: NodeType): ElementResult {
  const edges: FlowEdge[] = [];

  const name = getText(el, "name");
  const label = getText(el, "label") || name;
  const obj = getText(el, "object");

  const node: FlowNode = {
    id: name,
    type,
    label,
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: {
      xmlElement: el.outerHTML,
      object: obj,
    },
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

  // Find nodes with outgoing connections
  const nodesWithOutgoing = new Set(edges.map((e) => e.source));

  // Track nodes reached via fault connectors
  const faultReachedNodes = new Set<string>();
  edges.forEach((e) => {
    if (e.type === "fault") {
      faultReachedNodes.add(e.target);
    }
  });

  let endNodeCount = 0;

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
    (node) => !nodesWithOutgoing.has(node.id) && node.type !== "START"
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

  return {
    nodes: finalNodes,
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
