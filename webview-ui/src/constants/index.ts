/**
 * Flow Visualizer Constants
 *
 * Based on Salesforce's Auto-Layout Canvas configuration:
 * - alcCanvasUtils.js: Element metadata, node types
 * - alcComponentsUtils.js: Styling, positioning
 * - alcStyles.js: CSS variables and styling constants
 */

// Re-export from modular files
export * from "./dimensions";
export * from "./theme";
export * from "./nodeTypes";
export * from "./flowTypes";

// Re-export NODE_CONFIG as default for backward compatibility
export { default } from "./nodeTypes";
