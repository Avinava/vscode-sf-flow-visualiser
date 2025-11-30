/**
 * Layout Configuration
 *
 * Default configuration values for the auto-layout engine,
 * based on Salesforce's getDefaultLayoutConfig().
 */

import type { LayoutConfig } from "../types";

// ============================================================================
// DEFAULT LAYOUT CONFIGURATION
// Based on Salesforce's getDefaultLayoutConfig()
// ============================================================================

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  node: {
    icon: {
      w: 48,
      h: 48,
    },
    width: 240, // Updated to match new NODE_WIDTH
    height: 56,
  },
  connector: {
    icon: {
      w: 20,
    },
  },
  grid: {
    hGap: 60, // Reduced horizontal gap for tighter layout
    vGap: 70, // Adjusted vertical gap
  },
  start: {
    x: 800, // Canvas center X
    y: 80, // Canvas top Y
  },
};

// Card layout config (for element cards mode)
export const CARD_LAYOUT_CONFIG: LayoutConfig = {
  ...DEFAULT_LAYOUT_CONFIG,
  node: {
    ...DEFAULT_LAYOUT_CONFIG.node,
    width: 285,
  },
};

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

/** Fault path special index (from alcCanvasUtils) */
export const FAULT_INDEX = -1;

/** For Each index in loops */
export const FOR_EACH_INDEX = 0;

/** Start immediate index for scheduled paths */
export const START_IMMEDIATE_INDEX = 0;
