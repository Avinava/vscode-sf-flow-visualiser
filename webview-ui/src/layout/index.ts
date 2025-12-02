/**
 * Layout module exports
 *
 * Modular layout engine based on Salesforce's Auto-Layout Canvas (ALC) system.
 */

// Main auto-layout function (backward compatible export)
export { autoLayout, autoLayoutWithFaultLanes, TreeLayoutEngine } from "./treeLayoutEngine";
export type { AutoLayoutOptions, LayoutResult, FaultLaneInfo } from "./treeLayoutEngine";

// Layout configuration
export {
  DEFAULT_LAYOUT_CONFIG,
  CARD_LAYOUT_CONFIG,
  FAULT_INDEX,
  FOR_EACH_INDEX,
  START_IMMEDIATE_INDEX,
} from "./layoutConfig";

// Layout helpers
export {
  createNodeMap,
  createOutgoingMap,
  createIncomingMap,
  isBranchingNode,
  supportsChildren,
  getChildCount,
  resolveNode,
  findFirstElement,
  findLastElement,
  findParentElement,
  areAllBranchesTerminals,
  isGoingBackToAncestorLoop,
  getStyleFromGeometry,
  hasGoToOnNext,
  hasGoToOnBranchHead,
} from "./layoutHelpers";

// Branch calculations
export {
  calculateBranchDepth,
  calculateSubtreeWidth,
  calculateBranchWidths,
  calculateTotalBranchWidth,
} from "./branchCalculator";

// Merge point detection
export {
  findMergePointForBranches,
  findAllMergePoints,
} from "./mergePointFinder";
