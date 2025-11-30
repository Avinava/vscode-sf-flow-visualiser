/**
 * Dimension Constants
 *
 * Based on Salesforce's CSS variables from alcCanvas:
 * - alcStyles.js: CSS variables and styling constants
 * - alcComponentsUtils.js: Positioning calculations
 */

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
// MENU DIMENSIONS
// ============================================================================

export const MENU_WIDTH = 300; // --alc-menu-width

// ============================================================================
// CONNECTOR GEOMETRY
// ============================================================================

export const CORNER_RADIUS = 12; // Rounded corners for orthogonal connectors
export const ARROW_SIZE = 8; // Arrow marker size
export const CONNECTOR_STROKE_WIDTH = 1.5;
export const CONNECTOR_HIGHLIGHT_WIDTH = 3;
