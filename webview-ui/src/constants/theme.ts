/**
 * Theme and Color Constants
 *
 * Based on Salesforce's design system:
 * - alcStyles.js: CSS variables
 * - alcComponentsUtils.js: Color mappings
 */

// ============================================================================
// CONNECTOR COLORS
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
// NODE COLORS BY CATEGORY
// Based on Salesforce's design system
// ============================================================================

export const NODE_COLORS = {
  // Flow control
  start: "#22c55e", // Green
  end: "#ef4444", // Red
  decision: "#f59e0b", // Amber/Orange
  wait: "#eab308", // Yellow
  loop: "#ec4899", // Pink

  // User interaction
  screen: "#3b82f6", // Blue
  assignment: "#f97316", // Orange

  // Data operations
  recordCreate: "#ef4444", // Red
  recordUpdate: "#f59e0b", // Amber
  recordLookup: "#ef4444", // Red
  recordDelete: "#dc2626", // Dark Red

  // Actions
  action: "#06b6d4", // Cyan
  subflow: "#8b5cf6", // Purple
  apex: "#8b5cf6", // Purple
  email: "#06b6d4", // Cyan
  chatter: "#3b82f6", // Blue

  // Integrations
  externalService: "#6366f1", // Indigo
  quickAction: "#f97316", // Orange

  // Utilities
  customError: "#dc2626", // Dark Red
  transform: "#10b981", // Emerald
  collectionProcessor: "#f59e0b", // Amber

  // Internal
  root: "#64748b", // Slate
  branch: "#64748b", // Slate
  group: "#64748b", // Slate
} as const;

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
} as const;

// ============================================================================
// THEME VARIABLES
// Can be extended for dark/light mode support
// ============================================================================

export const THEME = {
  canvas: {
    background: "#f8fafc", // slate-50
    gridColor: "#e2e8f0", // slate-200
    gridSize: 20,
  },
  node: {
    background: "#ffffff",
    border: "#e2e8f0", // slate-200
    borderHover: "#94a3b8", // slate-400
    borderSelected: "#3b82f6", // blue-500
    text: "#1e293b", // slate-800
    textMuted: "#64748b", // slate-500
    shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    shadowHover: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  sidebar: {
    background: "#ffffff",
    border: "#e2e8f0",
  },
  toolbar: {
    background: "rgba(255, 255, 255, 0.9)",
    border: "#e2e8f0",
  },
} as const;
