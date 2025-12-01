/**
 * Connector Path Service
 *
 * Generates SVG path strings for flow connectors.
 * Centralizes all path generation logic for consistent connector rendering.
 *
 * Based on Salesforce's alcConnector patterns.
 */

import type { Point } from "../hooks/useCanvasInteraction";
import { FAULT_LANE_CLEARANCE, GRID_H_GAP } from "../constants/dimensions";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CORNER_RADIUS = 12;
const FAULT_LANE_OFFSET = FAULT_LANE_CLEARANCE;
const FAULT_HORIZONTAL_OFFSET = Math.max(
  Math.round(FAULT_LANE_OFFSET * 0.65),
  GRID_H_GAP + 40
);
const FAULT_GOTO_SOURCE_OFFSET = Math.max(
  Math.round(FAULT_LANE_OFFSET * 0.45),
  GRID_H_GAP + 24
);
const FAULT_GOTO_STACK_OFFSET = Math.max(Math.round(GRID_H_GAP / 3), 16);
const FAULT_GOTO_VERTICAL_STACK_MULTIPLIER = 10;
const REGULAR_FAULT_TARGET_CLEARANCE = Math.max(
  Math.round(FAULT_LANE_OFFSET * 0.25),
  24
);
const REGULAR_FAULT_STACK_OFFSET = Math.max(Math.round(GRID_H_GAP / 2.5), 18);
const REGULAR_FAULT_MIN_TARGET_CLEARANCE = Math.max(
  Math.round(GRID_H_GAP / 2),
  20
);

// ============================================================================
// TYPES
// ============================================================================

export interface PathOptions {
  cornerRadius?: number;
}

export interface OrthogonalPathOptions extends PathOptions {
  bendStrategy?: "near-target" | "near-source" | "midpoint";
}

export interface BranchDropOptions extends PathOptions {
  dropStrategy?: "auto" | "horizontal-first" | "vertical-first";
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
   * Create a fault GoTo connector path
   * Goes right from source, down, then left to target's right side
   * Used when a fault connector targets a node in the main flow (GoTo)
   *
   * @param src - Source point (right side of source node)
   * @param tgt - Target point (right side of target node for main flow, left side for fault lane)
   * @param options - Path options
   */
  static createFaultGoToPath(
    src: Point,
    tgt: Point,
    options: FaultPathOptions & {
      targetInFaultLane?: boolean;
      verticalOffset?: number;
    } = {}
  ): string {
    const {
      cornerRadius = DEFAULT_CORNER_RADIUS,
      faultIndex = 0,
      targetInFaultLane = false,
      verticalOffset = 0,
    } = options;

    // If target is already in the fault lane (to the right), route more directly
    if (targetInFaultLane || tgt.x > src.x + FAULT_HORIZONTAL_OFFSET) {
      const turnX = this.getFaultGoToLaneX(src.x, {
        faultIndex,
        verticalOffset,
      });
      const goingDown = tgt.y > src.y;
      const verticalYStart = goingDown
        ? src.y + cornerRadius
        : src.y - cornerRadius;
      const verticalYEnd = goingDown
        ? tgt.y - cornerRadius
        : tgt.y + cornerRadius;

      if (goingDown) {
        // Target below: right → down → right to target
        return `M ${src.x} ${src.y}
                L ${turnX - cornerRadius} ${src.y}
                Q ${turnX} ${src.y}, ${turnX} ${verticalYStart}
                L ${turnX} ${verticalYEnd}
                Q ${turnX} ${tgt.y}, ${turnX + cornerRadius} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      } else {
        // Target above: right → up → right to target
        return `M ${src.x} ${src.y}
                L ${turnX - cornerRadius} ${src.y}
                Q ${turnX} ${src.y}, ${turnX} ${verticalYStart}
                L ${turnX} ${verticalYEnd}
                Q ${turnX} ${tgt.y}, ${turnX + cornerRadius} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      }
    }

    // Target is in main flow (same column or to the left) - go into dedicated fault lane
    const startClearance =
      src.x + FAULT_LANE_CLEARANCE + faultIndex * 20 + verticalOffset;
    const laneX = Math.max(
      Math.max(src.x, tgt.x) + FAULT_LANE_CLEARANCE,
      startClearance
    );
    const turnX = laneX;

    // If target is above source, path goes: right → up → left
    // If target is below source, path goes: right → down → left
    const goingDown = tgt.y > src.y;

    if (goingDown) {
      return `M ${src.x} ${src.y}
              L ${turnX - cornerRadius} ${src.y}
              Q ${turnX} ${src.y}, ${turnX} ${src.y + cornerRadius}
              L ${turnX} ${tgt.y - cornerRadius}
              Q ${turnX} ${tgt.y}, ${turnX - cornerRadius} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    } else {
      return `M ${src.x} ${src.y}
              L ${turnX - cornerRadius} ${src.y}
              Q ${turnX} ${src.y}, ${turnX} ${src.y - cornerRadius}
              L ${turnX} ${tgt.y + cornerRadius}
              Q ${turnX} ${tgt.y}, ${turnX - cornerRadius} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    }
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

    // Check if nearly horizontal (allow small offsets to stay straight)
    if (Math.abs(tgt.y - src.y) < 25) {
      return this.createStraightPath(src, tgt);
    }

    const horizontalEndX = this.getRegularFaultLaneX(src.x, tgt.x, faultIndex);

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
   * Compute the X position of the near-source lane for fault GoTo connectors.
   * Exported so renderers can align labels to the same lane.
   */
  static getFaultGoToLaneX(
    srcX: number,
    options: { faultIndex?: number; verticalOffset?: number } = {}
  ): number {
    const { faultIndex = 0, verticalOffset = 0 } = options;
    return (
      srcX +
      FAULT_GOTO_SOURCE_OFFSET +
      faultIndex * FAULT_GOTO_STACK_OFFSET +
      verticalOffset * FAULT_GOTO_VERTICAL_STACK_MULTIPLIER
    );
  }

  private static getRegularFaultLaneX(
    srcX: number,
    tgtX: number,
    faultIndex: number = 0
  ): number {
    const laneNearTarget =
      tgtX -
      REGULAR_FAULT_TARGET_CLEARANCE -
      faultIndex * REGULAR_FAULT_STACK_OFFSET;
    const minLane = srcX + FAULT_HORIZONTAL_OFFSET;
    const maxLane = tgtX - REGULAR_FAULT_MIN_TARGET_CLEARANCE;

    if (maxLane <= minLane) {
      return maxLane;
    }

    const clampedLane = Math.max(minLane, laneNearTarget);
    return Math.min(clampedLane, maxLane);
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
    options: BranchDropOptions = {}
  ): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS, dropStrategy = "auto" } =
      options;
    const dx = tgt.x - branchX;
    const dy = tgt.y - branchY;

    // Straight vertical drop if aligned horizontally
    if (Math.abs(dx) < 5) {
      return `M ${branchX} ${branchY} L ${tgt.x} ${tgt.y}`;
    }

    const resolvedStrategy =
      dropStrategy === "auto" ? "vertical-first" : dropStrategy;

    if (resolvedStrategy === "horizontal-first") {
      const horizontalSign = dx > 0 ? 1 : -1;
      const verticalSign = dy >= 0 ? 1 : -1;
      const horizontalCornerX = tgt.x - horizontalSign * cornerRadius;
      const verticalCornerY = branchY + verticalSign * cornerRadius;

      return `M ${branchX} ${branchY}
              L ${horizontalCornerX} ${branchY}
              Q ${tgt.x} ${branchY}, ${tgt.x} ${verticalCornerY}
              L ${tgt.x} ${tgt.y}`;
    }

    // Default vertical-first orthogonal routing
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
