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

const DEFAULT_CORNER_RADIUS = 16;
const FAULT_LANE_GAP = 40; // Gap between stacked fault lanes

// ============================================================================
// TYPES
// ============================================================================

export interface PathOptions {
  cornerRadius?: number;
}

export interface OrthogonalPathOptions extends PathOptions {
  bendStrategy?: "near-target" | "near-source" | "midpoint";
  /** Y positions of nodes between source and target to avoid routing through */
  avoidZones?: { y: number; height: number }[];
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
   * Based on Salesforce's connector path generation in autoLayoutCanvas.js
   * - Uses proper corner radius clamping to prevent overlapping curves
   * - Ensures fully orthogonal paths (horizontal and vertical segments only)
   *
   * @param src - Source point
   * @param tgt - Target point
   * @param options - Path options including bend strategy
   */
  static createOrthogonalPath(src: Point, tgt: Point, options: OrthogonalPathOptions = {}): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS, bendStrategy = "near-target", avoidZones } = options;

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;

    // Straight vertical line if aligned horizontally (within tolerance)
    if (Math.abs(dx) < 3) {
      return this.createStraightPath(src, tgt);
    }

    const sign = dx > 0 ? 1 : -1;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Clamp corner radius to ensure proper orthogonal corners
    // Use absDy/3 (not /4) and smaller fudge factor for smoother curves
    const maxRadiusForHorizontal = absDx / 2 - 1;
    const maxRadiusForVertical = absDy / 3 - 1;
    const r = Math.max(4, Math.min(cornerRadius, maxRadiusForHorizontal, maxRadiusForVertical));

    // Determine bend Y position based on strategy
    let bendY: number;

    if (bendStrategy === "near-source") {
      bendY = src.y + Math.min(40, absDy / 4);
    } else if (bendStrategy === "midpoint") {
      bendY = src.y + dy / 2;
    } else {
      // "near-target" - default
      bendY = tgt.y - Math.min(35, absDy / 4);
    }

    // Ensure bend is between source and target with room for corners
    const minBendY = src.y + r + 5;
    const maxBendY = tgt.y - r - 5;
    bendY = Math.max(minBendY, Math.min(bendY, maxBendY));

    // Bug 2 fix: If avoidZones are provided, shift bendY to the largest
    // gap between obstacles so the horizontal segment doesn't cross a node
    if (avoidZones && avoidZones.length > 0) {
      const zones = avoidZones
        .filter((z) => z.y > src.y && z.y + z.height < tgt.y)
        .sort((a, b) => a.y - b.y);

      if (zones.length > 0) {
        // Build list of gaps: before first zone, between zones, after last zone
        const gaps: { start: number; end: number }[] = [];
        gaps.push({ start: src.y + r + 5, end: zones[0].y - 5 });
        for (let i = 0; i < zones.length - 1; i++) {
          gaps.push({ start: zones[i].y + zones[i].height + 5, end: zones[i + 1].y - 5 });
        }
        gaps.push({ start: zones[zones.length - 1].y + zones[zones.length - 1].height + 5, end: tgt.y - r - 5 });

        // Check if current bendY falls inside an obstacle
        const isInsideObstacle = zones.some((z) => bendY >= z.y - 5 && bendY <= z.y + z.height + 5);

        if (isInsideObstacle) {
          // Find the largest valid gap and place bendY at its center
          let bestGap: { start: number; end: number } | null = null;
          let bestSize = 0;
          for (const gap of gaps) {
            const size = gap.end - gap.start;
            if (size > bestSize && size > r * 2) {
              bestSize = size;
              bestGap = gap;
            }
          }
          if (bestGap) {
            bendY = (bestGap.start + bestGap.end) / 2;
          }
        }
      }
    }

    // For very short vertical distances, use a simpler two-corner path
    if (absDy < 80) {
      // Calculate a safe bend position
      const shortBendY = src.y + absDy / 2;
      const shortR = Math.min(r, absDy / 4 - 1, absDx / 2 - 1);

      if (shortR < 4) {
        // Too tight for curves, use straight lines with minimal corners
        return `M ${src.x} ${src.y} 
                L ${src.x} ${shortBendY}
                L ${tgt.x} ${shortBendY}
                L ${tgt.x} ${tgt.y}`;
      }

      return `M ${src.x} ${src.y} 
              L ${src.x} ${shortBendY - shortR}
              Q ${src.x} ${shortBendY}, ${src.x + sign * shortR} ${shortBendY}
              L ${tgt.x - sign * shortR} ${shortBendY}
              Q ${tgt.x} ${shortBendY}, ${tgt.x} ${shortBendY + shortR}
              L ${tgt.x} ${tgt.y}`;
    }

    // Standard orthogonal path with proper corner handling
    return `M ${src.x} ${src.y} 
            L ${src.x} ${bendY - r}
            Q ${src.x} ${bendY}, ${src.x + sign * r} ${bendY}
            L ${tgt.x - sign * r} ${bendY}
            Q ${tgt.x} ${bendY}, ${tgt.x} ${bendY + r}
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
  static createFaultPath(src: Point, tgt: Point, options: FaultPathOptions = {}): string {
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
    const { cornerRadius = DEFAULT_CORNER_RADIUS, laneX, faultIndex = 0, targetInFaultLane = false, verticalOffset = 0 } = options;

    const r = cornerRadius;

    // Calculate lane position
    const calculatedLaneX = laneX ?? src.x + FAULT_LANE_CLEARANCE + faultIndex * FAULT_LANE_GAP + verticalOffset * 10;

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
  private static calculateFaultLaneX(srcX: number, tgtX: number, faultIndex: number): number {
    const baseLaneX = Math.max(srcX, tgtX) + FAULT_LANE_CLEARANCE;
    return baseLaneX + faultIndex * FAULT_LANE_GAP;
  }

  /**
   * Get the X position of the fault lane for external use (e.g., label positioning)
   */
  static getFaultLaneX(srcX: number, options: { faultIndex?: number; laneX?: number } = {}): number {
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
  static createLoopBackPath(src: Point, tgt: Point, options: PathOptions & { minLeftX?: number; wide?: boolean } = {}): string {
    const { cornerRadius = 20, minLeftX, wide = false } = options;

    // Calculate the leftmost X position for the loop-back
    // Use a comfortable offset from the leftmost point (source or target)
    const minX = Math.min(src.x, tgt.x);
    const offsetX = Math.max(60, Math.abs(src.x - tgt.x) / 2 + 50);
    let leftX = minX - offsetX;

    // Bug 5 fix: If there are nodes to the left (e.g., left-side branches
    // in a nested decision), ensure the loop-back wraps around them
    if (minLeftX !== undefined) {
      leftX = Math.min(leftX, minLeftX - 40);
    }

    // Vertical positions for the turns
    const bottomY = src.y + 30; // Drop down a bit from source
    const topY = tgt.y - 15; // Come up to just above target

    // Create a smooth path with larger corner radii for elegance
    const r = Math.min(cornerRadius, Math.abs(bottomY - topY) / 4, Math.abs(src.x - leftX) / 2);

    if (wide) {
      // Fix 10: Wide variant (SF's xe()) — extra initial drop + arc for wider nodes
      // 9-segment path vs standard 7-segment
      const initialDrop = r; // Small initial vertical drop before going horizontal
      return `M ${src.x} ${src.y}
              L ${src.x} ${src.y + initialDrop}
              Q ${src.x} ${src.y + initialDrop + r}, ${src.x - r} ${src.y + initialDrop + r}
              L ${leftX + r} ${src.y + initialDrop + r}
              Q ${leftX} ${src.y + initialDrop + r}, ${leftX} ${src.y + initialDrop}
              L ${leftX} ${topY + r}
              Q ${leftX} ${topY}, ${leftX + r} ${topY}
              L ${tgt.x - r} ${topY}
              Q ${tgt.x} ${topY}, ${tgt.x} ${topY + r}
              L ${tgt.x} ${tgt.y}`;
    }

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
   * Create a loop "After Last" connector path (goes right and down)
   *
   * This creates the exit path from a loop that wraps around the right side,
   * matching Salesforce's LOOP_AFTER_LAST pattern (ye() function).
   * The path goes:
   * 1. Horizontal right from the loop node
   * 2. Curves down
   * 3. Goes down along the right side
   * 4. Curves left
   * 5. Goes horizontal left
   * 6. Curves down
   * 7. Connects to the target below
   *
   * @param src - Source point (bottom of loop node)
   * @param tgt - Target point (top of post-loop node)
   * @param maxRightX - Maximum X of loop body nodes (for wrapping width)
   */
  static createLoopAfterLastPath(
    src: Point,
    tgt: Point,
    options: PathOptions & { maxRightX?: number } = {}
  ): string {
    const { cornerRadius = 20, maxRightX } = options;

    // Calculate the rightmost X position for the after-last path
    const maxX = Math.max(src.x, tgt.x);
    const offsetX = Math.max(60, Math.abs(src.x - tgt.x) / 2 + 50);
    let rightX = maxX + offsetX;

    // If there are nodes to the right, ensure the path wraps around them
    if (maxRightX !== undefined) {
      rightX = Math.max(rightX, maxRightX + 40);
    }

    // Vertical positions for the turns
    const topY = src.y + 30; // Drop down a bit from source
    const bottomY = tgt.y - 15; // Come up to just above target

    // Create a smooth path with corner radii
    const r = Math.min(cornerRadius, Math.abs(bottomY - topY) / 4, Math.abs(rightX - src.x) / 2);

    return `M ${src.x} ${src.y}
            L ${src.x} ${topY - r}
            Q ${src.x} ${topY}, ${src.x + r} ${topY}
            L ${rightX - r} ${topY}
            Q ${rightX} ${topY}, ${rightX} ${topY + r}
            L ${rightX} ${bottomY - r}
            Q ${rightX} ${bottomY}, ${rightX - r} ${bottomY}
            L ${tgt.x + r} ${bottomY}
            Q ${tgt.x} ${bottomY}, ${tgt.x} ${bottomY + r}
            L ${tgt.x} ${tgt.y}`;
  }

  /**
   * Create a GoTo connector path with horizontal jog at termination
   *
   * Based on Salesforce's GoTo connector (he() function).
   * Similar to a straight path but with a small horizontal jog at the end
   * to visually distinguish GoTo connectors from regular ones.
   *
   * @param src - Source point (bottom of source node)
   * @param tgt - Target point (top of target node)
   * @param options - Path options
   */
  static createGoToPath(src: Point, tgt: Point, options: PathOptions = {}): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS } = options;

    const dy = tgt.y - src.y;
    const dx = tgt.x - src.x;
    const r = Math.min(cornerRadius, Math.abs(dy) / 4);

    // If source and target are at different X positions, use orthogonal routing
    if (Math.abs(dx) > 5) {
      return this.createOrthogonalPath(src, tgt, { cornerRadius });
    }

    // Short horizontal jog at the end (≈30px) — SF's characteristic GoTo visual
    const jogLength = 30;
    const jogDirection = 1; // Always jog to the right

    if (r < 4 || Math.abs(dy) < jogLength + r * 2) {
      // Too short for a proper jog, fall back to straight
      return this.createStraightPath(src, tgt);
    }

    return `M ${src.x} ${src.y}
            L ${src.x} ${tgt.y - r}
            Q ${src.x} ${tgt.y}, ${src.x + jogDirection * r} ${tgt.y}
            L ${src.x + jogDirection * jogLength} ${tgt.y}`;
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
  static createBranchDropPath(branchX: number, branchY: number, tgt: Point, options: BranchDropOptions = {}): string {
    const { cornerRadius = DEFAULT_CORNER_RADIUS, dropStrategy = "auto" } = options;
    const dx = tgt.x - branchX;
    const dy = tgt.y - branchY;

    // Straight vertical drop if aligned horizontally
    if (Math.abs(dx) < 5) {
      return `M ${branchX} ${branchY} L ${tgt.x} ${tgt.y}`;
    }

    const resolvedStrategy = dropStrategy === "auto" ? "vertical-first" : dropStrategy;

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
  static createMergeRisePath(src: Point, mergeX: number, mergeY: number, options: PathOptions = {}): string {
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
