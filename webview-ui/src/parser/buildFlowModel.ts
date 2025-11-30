/**
 * Flow model normalization utilities.
 *
 * Salesforce keeps a normalized store of nodes where every element knows about
 * its parent, previous/next siblings, branch children, fault paths, etc. The
 * visualizer relies on the same relationships for layout/UX parity.
 */

import type { FlowEdge, FlowNode } from "../types";
import { getBranchEdgesForNode, sortBranchEdges } from "../utils/graph";

interface EdgeMaps {
  outgoing: Map<string, FlowEdge[]>;
  incoming: Map<string, FlowEdge[]>;
}

function buildEdgeMaps(edges: FlowEdge[]): EdgeMaps {
  const outgoing = new Map<string, FlowEdge[]>();
  const incoming = new Map<string, FlowEdge[]>();

  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push(edge);

    if (!incoming.has(edge.target)) {
      incoming.set(edge.target, []);
    }
    incoming.get(edge.target)!.push(edge);
  });

  return { outgoing, incoming };
}

function cloneNodes(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((node) => [node.id, { ...node }]));
}

function firstNonFaultEdge(edges: FlowEdge[]): FlowEdge | undefined {
  return edges.find(
    (edge) => edge.type !== "fault" && edge.type !== "fault-end"
  );
}

function firstEdgeMatching(
  edges: FlowEdge[],
  predicate: (edge: FlowEdge) => boolean
): FlowEdge | undefined {
  return edges.find(predicate);
}

function calculateTerminalState(node: FlowNode, edges: FlowEdge[]): boolean {
  if (node.type === "START") {
    return false;
  }
  return !edges.some(
    (edge) => edge.type !== "fault" && edge.type !== "fault-end"
  );
}

/**
 * Build Salesforce-like relationships (next/prev/children/fault) for nodes.
 */
export function buildFlowRelationships(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode[] {
  const nodeMap = cloneNodes(nodes);
  const { outgoing, incoming } = buildEdgeMaps(edges);

  // Step 1: annotate each node with next/fault/children/incoming goto info
  nodeMap.forEach((node) => {
    const nodeOuts = outgoing.get(node.id) || [];
    const primaryEdges = nodeOuts.filter(
      (edge) => edge.type !== "fault" && edge.type !== "fault-end"
    );

    const faultEdge = nodeOuts.find(
      (edge) => edge.type === "fault" || edge.type === "fault-end"
    );
    node.fault = faultEdge?.target;

    // GoTo targets (incoming) will be set later; this just prevents stale data
    node.incomingGoTo = undefined;

    if (node.type === "LOOP") {
      const branchEdges = sortBranchEdges(
        node,
        getBranchEdgesForNode(node, nodeOuts)
      );
      node.children = branchEdges
        .filter((edge) => edge.type === "loop-next")
        .map((edge) => edge.target ?? null);

      const loopExit = firstEdgeMatching(
        nodeOuts,
        (edge) => edge.type === "loop-end"
      );
      node.next = loopExit?.target;
    } else if (
      node.type === "DECISION" ||
      node.type === "WAIT" ||
      (node.type === "START" && primaryEdges.length > 1)
    ) {
      const branchEdges = sortBranchEdges(
        node,
        getBranchEdgesForNode(node, nodeOuts)
      );
      if (branchEdges.length) {
        node.children = branchEdges.map((edge) => edge.target ?? null);
      } else {
        node.children = undefined;
      }
      node.next = undefined; // handled via merge points downstream
    } else {
      node.children = undefined;
      const forwardEdge = firstNonFaultEdge(nodeOuts);
      node.next = forwardEdge?.target;
    }

    node.isTerminal = calculateTerminalState(node, primaryEdges);
  });

  // Step 2: populate prev references and incoming GoTo metadata
  nodeMap.forEach((node) => {
    const nodeIncoming = incoming.get(node.id) || [];
    const linearIncoming = nodeIncoming.filter(
      (edge) => edge.type !== "fault" && edge.type !== "fault-end"
    );

    if (linearIncoming.length === 1) {
      node.prev = linearIncoming[0].source;
    } else {
      node.prev = undefined;
    }

    const goToSources = nodeIncoming
      .filter((edge) => edge.isGoTo)
      .map((edge) => edge.source);
    node.incomingGoTo = goToSources.length ? goToSources : undefined;
  });

  // Step 3: wire parent + childIndex for branching nodes
  nodeMap.forEach((node) => {
    if (!node.children) return;

    node.children.forEach((childId, index) => {
      if (!childId) return;
      const child = nodeMap.get(childId);
      if (child) {
        child.parent = node.id;
        child.childIndex = index;
      }
    });
  });

  return Array.from(nodeMap.values());
}

export default buildFlowRelationships;
