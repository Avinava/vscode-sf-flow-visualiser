/**
 * Connector Path Service
 *
 * Generates SVG path strings for flow connectors.
 * Centralizes all path generation logic for consistent connector rendering.
 *
 * Based on Salesforce's alcConnector patterns from autoLayoutCanvas.js
 */

import type { Point } from "../hooks/useCanvasInteraction";
import { FAULT_LANE_CLEARANCE } from "../constants/dimensions";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CORNER_RADIUS = 12;
const FAULT_LANE_GAP = 40; // Gap between stacked fault lanes

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
  laneX?: number; // Pre-calculated lane X position (from layout engine)
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
   * Create a fault connector path following Salesforce's pattern
   * 
   * The path always follows this structure:
   * 1. Exit horizontally from source right side
   * 2. Turn down (or up) at the fault lane
   * 3. Travel vertically in the fault lane
   * 4. Turn left to enter target from the right
   *
   * @param src - Source point (right side of source node)
   * @param tgt - Target point (left side of target node)
   * @param options - Path options including pre-calculated lane position
   */
  static createFaultPath(
    src: Point,
    tgt: Point,
    options: FaultPathOptions = {}
  ): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS, laneX, faultIndex = 0 } = options;

    // Straight horizontal line if nearly horizontal and target is to the right
    if (Math.abs(tgt.y - src.y) < 5 && tgt.x > src.x) {
      return this.createStraightPath(src, tgt);
    }

    // Calculate the lane X position
    // Use pre-calculated lane if provided, otherwise calculate based on positions
    const calculatedLaneX = laneX ?? this.calculateFaultLaneX(src.x, tgt.x, faultIndex);
    
    const goingDown = tgt.y > src.y;
    const r = cornerRadius;

    // Build the path: right → vertical → left to target
    if (goingDown) {
      // Source above target: right → down → left
      return `M ${src.x} ${src.y}
              L ${calculatedLaneX - r} ${src.y}
              Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y + r}
              L ${calculatedLaneX} ${tgt.y - r}
              Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX - r} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    } else {
      // Source below target: right → up → left
      return `M ${src.x} ${src.y}
              L ${calculatedLaneX - r} ${src.y}
              Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y - r}
              L ${calculatedLaneX} ${tgt.y + r}
              Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX - r} ${tgt.y}
              L ${tgt.x} ${tgt.y}`;
    }
  }

  /**
   * Create a fault GoTo connector path
   * Used when a fault connector targets a node in the main flow
   * 
   * The path structure:
   * 1. Exit horizontally from source right side
   * 2. Travel to the fault lane
   * 3. Travel vertically in the fault lane
   * 4. Turn to enter target from appropriate side
   *
   * @param src - Source point (right side of source node)
   * @param tgt - Target point (appropriate side of target node)
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
      laneX,
      faultIndex = 0,
      targetInFaultLane = false,
      verticalOffset = 0,
    } = options;

    const r = cornerRadius;
    
    // Calculate lane position
    const calculatedLaneX = laneX ?? (src.x + FAULT_LANE_CLEARANCE + faultIndex * FAULT_LANE_GAP + verticalOffset * 10);
    
    const goingDown = tgt.y > src.y;

    if (targetInFaultLane || tgt.x > calculatedLaneX) {
      // Target is to the right of our lane - connect from left
      if (goingDown) {
        return `M ${src.x} ${src.y}
                L ${calculatedLaneX - r} ${src.y}
                Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y + r}
                L ${calculatedLaneX} ${tgt.y - r}
                Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX + r} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      } else {
        return `M ${src.x} ${src.y}
                L ${calculatedLaneX - r} ${src.y}
                Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y - r}
                L ${calculatedLaneX} ${tgt.y + r}
                Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX + r} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      }
    } else {
      // Target is to the left of our lane - connect from right
      if (goingDown) {
        return `M ${src.x} ${src.y}
                L ${calculatedLaneX - r} ${src.y}
                Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y + r}
                L ${calculatedLaneX} ${tgt.y - r}
                Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX - r} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      } else {
        return `M ${src.x} ${src.y}
                L ${calculatedLaneX - r} ${src.y}
                Q ${calculatedLaneX} ${src.y}, ${calculatedLaneX} ${src.y - r}
                L ${calculatedLaneX} ${tgt.y + r}
                Q ${calculatedLaneX} ${tgt.y}, ${calculatedLaneX - r} ${tgt.y}
                L ${tgt.x} ${tgt.y}`;
      }
    }
  }

  /**
   * Calculate the X position of the fault lane
   * Ensures lanes don't overlap and are positioned consistently
   */
  private static calculateFaultLaneX(
    srcX: number,
    tgtX: number,
    faultIndex: number
  ): number {
    const baseLaneX = Math.max(srcX, tgtX) + FAULT_LANE_CLEARANCE;
    return baseLaneX + faultIndex * FAULT_LANE_GAP;
  }

  /**
   * Get the X position of the fault lane for external use (e.g., label positioning)
   */
  static getFaultLaneX(
    srcX: number,
    options: { faultIndex?: number; laneX?: number } = {}
  ): number {
    const { faultIndex = 0, laneX } = options;
    if (laneX !== undefined) {
      return laneX;
    }
    return srcX + FAULT_LANE_CLEARANCE + faultIndex * FAULT_LANE_GAP;
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
