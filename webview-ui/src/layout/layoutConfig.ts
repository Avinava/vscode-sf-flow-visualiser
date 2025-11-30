/**
 * Layout Configuration
 *
 * Default configuration values for the auto-layout engine,
 * based on Salesforce's getDefaultLayoutConfig().
 */

import type { LayoutConfig } from "../types";
import {
  ELEMENT_CARD_WIDTH,
  GRID_H_GAP,
  GRID_V_GAP,
  NODE_HEIGHT,
  NODE_ICON_SIZE,
  NODE_WIDTH,
  START_X,
  START_Y,
} from "../constants/dimensions";

// ============================================================================
// DEFAULT LAYOUT CONFIGURATION
// Based on Salesforce's getDefaultLayoutConfig()
// ============================================================================

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  node: {
    icon: {
      w: NODE_ICON_SIZE,
      h: NODE_ICON_SIZE,
    },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  },
  connector: {
    icon: {
      w: 20,
    },
  },
  grid: {
    hGap: GRID_H_GAP, // Reduced horizontal gap for tighter layout
    vGap: GRID_V_GAP, // Adjusted vertical gap
  },
  start: {
    x: START_X, // Canvas center X
    y: START_Y, // Canvas top Y
  },
};

// Card layout config (for element cards mode)
export const CARD_LAYOUT_CONFIG: LayoutConfig = {
  ...DEFAULT_LAYOUT_CONFIG,
  node: {
    ...DEFAULT_LAYOUT_CONFIG.node,
    width: ELEMENT_CARD_WIDTH,
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
