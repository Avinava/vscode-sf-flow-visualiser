/**
 * Connector Path Service
 *
 * Generates SVG path strings for flow connectors.
 * Centralizes all path generation logic for consistent connector rendering.
 *
 * Based on Salesforce's alcConnector patterns.
 */

import type { Point } from "../hooks/useCanvasInteraction";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CORNER_RADIUS = 12;
const FAULT_HORIZONTAL_OFFSET = 50;

// ============================================================================
// TYPES
// ============================================================================

export interface PathOptions {
  cornerRadius?: number;
}

export interface OrthogonalPathOptions extends PathOptions {
  bendStrategy?: "near-target" | "near-source" | "midpoint";
}

export interface FaultPathOptions extends PathOptions {
  faultIndex?: number;
}

// ============================================================================
// CONNECTOR PATH SERVICE
// ============================================================================

export class ConnectorPathService {
  /**
   * Create a straight vertical line path
   */
  static createStraightPath(src: Point, tgt: Point): string {
    return `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`;
  }

  /**
   * Create an orthogonal path with rounded corners
   *
   * @param src - Source point
   * @param tgt - Target point
   * @param options - Path options including bend strategy
   */
  static createOrthogonalPath(
    src: Point,
    tgt: Point,
    options: OrthogonalPathOptions = {}
  ): string {
    const {
      cornerRadius = DEFAULT_CORNER_RADIUS,
      bendStrategy = "near-target",
    } = options;

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;

    // Straight vertical line if aligned
    if (Math.abs(dx) < 5) {
      return this.createStraightPath(src, tgt);
    }

    const sign = dx > 0 ? 1 : -1;

    // Determine bend Y position based on strategy
    let bendY: number;

    if (bendStrategy === "near-source") {
      bendY = src.y + Math.min(40, dy / 4);
    } else if (bendStrategy === "midpoint") {
      bendY = src.y + dy / 2;
    } else {
      // "near-target" - default
      bendY = tgt.y - Math.min(35, dy / 4);
    }

    // Ensure bend is between source and target
    bendY = Math.max(
      src.y + cornerRadius + 5,
      Math.min(bendY, tgt.y - cornerRadius - 5)
    );

    // For very short vertical distances, use simpler path
    if (Math.abs(dy) < 60) {
      const shortBendY = Math.max(src.y + 15, tgt.y - 25);
      return `M ${src.x} ${src.y} 
              L ${src.x} ${shortBendY - cornerRadius}
              Q ${src.x} ${shortBendY}, ${src.x + sign * cornerRadius} ${shortBendY}
              L ${tgt.x - sign * cornerRadius} ${shortBendY}
              Q ${tgt.x} ${shortBendY}, ${tgt.x} ${shortBendY + cornerRadius}
              L ${tgt.x} ${tgt.y}`;
    }

    return `M ${src.x} ${src.y} 
            L ${src.x} ${bendY - cornerRadius}
            Q ${src.x} ${bendY}, ${src.x + sign * cornerRadius} ${bendY}
            L ${tgt.x - sign * cornerRadius} ${bendY}
            Q ${tgt.x} ${bendY}, ${tgt.x} ${bendY + cornerRadius}
            L ${tgt.x} ${tgt.y}`;
  }

  /**
   * Create a fault connector path (exits horizontally from right side)
   *
   * @param src - Source point (right side of node)
   * @param tgt - Target point
   * @param options - Path options including fault index for staggering
   */
  static createFaultPath(
    src: Point,
    tgt: Point,
    options: FaultPathOptions = {}
  ): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS, faultIndex = 0 } = options;

    // Check if nearly horizontal
    if (Math.abs(tgt.y - src.y) < 15) {
      return this.createStraightPath(src, tgt);
    }

    // Stagger horizontal offset for multiple fault paths
    const baseOffset = FAULT_HORIZONTAL_OFFSET;
    const staggerOffset = faultIndex * 25;
    const safetyMargin = 40; // keep some room before reaching the target column
    const availableSpace = tgt.x - src.x;

    // Dynamically expand the horizontal offset based on the space between
    // source and target so fault lanes don't crowd the main path.
    const desiredOffset = baseOffset + staggerOffset;
    let horizontalOffset = desiredOffset;
    if (availableSpace > desiredOffset + safetyMargin) {
      const extraSpace = availableSpace - desiredOffset - safetyMargin;
      const adaptiveOffset = desiredOffset + Math.min(extraSpace * 0.75, 200);
      horizontalOffset = Math.min(
        adaptiveOffset,
        availableSpace - safetyMargin
      );
    }

    const horizontalEndX = Math.max(
      src.x + baseOffset * 0.5,
      Math.min(src.x + horizontalOffset, tgt.x - safetyMargin)
    );

    if (tgt.y > src.y) {
      // Target is below
      return `M ${src.x} ${src.y} 
              L ${horizontalEndX - cornerRadius} ${src.y}
              Q ${horizontalEndX} ${src.y}, ${horizontalEndX} ${src.y + cornerRadius}
              L ${horizontalEndX} ${tgt.y - cornerRadius}
              Q ${horizontalEndX} ${tgt.y}, ${horizontalEndX + cornerRadius} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    } else {
      // Target is above
      return `M ${src.x} ${src.y} 
              L ${horizontalEndX - cornerRadius} ${src.y}
              Q ${horizontalEndX} ${src.y}, ${horizontalEndX} ${src.y - cornerRadius}
              L ${horizontalEndX} ${tgt.y + cornerRadius}
              Q ${horizontalEndX} ${tgt.y}, ${horizontalEndX + cornerRadius} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    }
  }

  /**
   * Create a loop-back connector path (goes left and up)
   *
   * This creates a smooth curved path that wraps around the left side,
   * similar to Salesforce's loop visualization. The path goes:
   * 1. Down from source
   * 2. Curves left
   * 3. Goes up along the left side
   * 4. Curves right
   * 5. Connects to the target from below
   *
   * @param src - Source point (bottom of source node)
   * @param tgt - Target point (top of loop node)
   * @param options - Path options
   */
  static createLoopBackPath(
    src: Point,
    tgt: Point,
    options: PathOptions = {}
  ): string {
    const { cornerRadius = 20 } = options;

    // Calculate the leftmost X position for the loop-back
    // Use a comfortable offset from the leftmost point (source or target)
    const minX = Math.min(src.x, tgt.x);
    const offsetX = Math.max(60, Math.abs(src.x - tgt.x) / 2 + 50);
    const leftX = minX - offsetX;

    // Vertical positions for the turns
    const bottomY = src.y + 30; // Drop down a bit from source
    const topY = tgt.y - 15; // Come up to just above target

    // Create a smooth path with larger corner radii for elegance
    const r = Math.min(cornerRadius, Math.abs(bottomY - topY) / 4, offsetX / 2);

    return `M ${src.x} ${src.y}
            L ${src.x} ${bottomY - r}
            Q ${src.x} ${bottomY}, ${src.x - r} ${bottomY}
            L ${leftX + r} ${bottomY}
            Q ${leftX} ${bottomY}, ${leftX} ${bottomY - r}
            L ${leftX} ${topY + r}
            Q ${leftX} ${topY}, ${leftX + r} ${topY}
            L ${tgt.x - r} ${topY}
            Q ${tgt.x} ${topY}, ${tgt.x} ${topY + r}
            L ${tgt.x} ${tgt.y}`;
  }

  /**
   * Create a horizontal line path
   */
  static createHorizontalLine(y: number, x1: number, x2: number): string {
    return `M ${x1} ${y} L ${x2} ${y}`;
  }

  /**
   * Create a vertical line path
   */
  static createVerticalLine(x: number, y1: number, y2: number): string {
    return `M ${x} ${y1} L ${x} ${y2}`;
  }

  /**
   * Create a branch drop path from horizontal branch line to target
   *
   * @param branchX - X position on branch line
   * @param branchY - Y position of branch line
   * @param tgt - Target point
   * @param options - Path options
   */
  static createBranchDropPath(
    branchX: number,
    branchY: number,
    tgt: Point,
    options: PathOptions = {}
  ): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS } = options;
    const dx = tgt.x - branchX;

    // Straight vertical drop if aligned
    if (Math.abs(dx) < 5) {
      return `M ${branchX} ${branchY} L ${tgt.x} ${tgt.y}`;
    }

    // Orthogonal routing with corners
    return this.createOrthogonalPath({ x: branchX, y: branchY }, tgt, {
      cornerRadius,
    });
  }

  /**
   * Create a merge rise path from source to horizontal merge line
   *
   * @param src - Source point (bottom of node)
   * @param mergeX - X position on merge line (can differ from src.x)
   * @param mergeY - Y position of merge line
   * @param options - Path options
   */
  static createMergeRisePath(
    src: Point,
    mergeX: number,
    mergeY: number,
    options: PathOptions = {}
  ): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS } = options;
    const dx = mergeX - src.x;

    // Straight vertical rise if aligned
    if (Math.abs(dx) < 5) {
      return `M ${src.x} ${src.y} L ${src.x} ${mergeY}`;
    }

    // Path with corner to merge line
    const sign = dx > 0 ? 1 : -1;

    return `M ${src.x} ${src.y}
            L ${src.x} ${mergeY - cornerRadius}
            Q ${src.x} ${mergeY}, ${src.x + sign * cornerRadius} ${mergeY}`;
  }
}

export default ConnectorPathService;
