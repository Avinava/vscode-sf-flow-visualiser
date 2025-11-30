/**
 * Edge Markers Component
 *
 * SVG marker definitions for arrow heads on connectors.
 * Based on Salesforce's connector styling patterns.
 */

import React from "react";
import { CONNECTOR_COLORS } from "../../constants";

/**
 * SVG marker definitions for edge arrow heads
 */
export const EdgeMarkers: React.FC = () => (
  <defs>
    {/* Default arrow (gray) */}
    <marker
      id="arrow"
      markerWidth="6"
      markerHeight="5"
      refX="5"
      refY="2.5"
      orient="auto"
    >
      <polygon points="0 0, 6 2.5, 0 5" fill={CONNECTOR_COLORS.default} />
    </marker>

    {/* Fault arrow (red) */}
    <marker
      id="arrow-red"
      markerWidth="6"
      markerHeight="5"
      refX="5"
      refY="2.5"
      orient="auto"
    >
      <polygon points="0 0, 6 2.5, 0 5" fill={CONNECTOR_COLORS.fault} />
    </marker>

    {/* Subtle animated fault arrow - gentle opacity pulse */}
    <marker
      id="arrow-red-animated"
      markerWidth="6"
      markerHeight="5"
      refX="5"
      refY="2.5"
      orient="auto"
    >
      <polygon points="0 0, 6 2.5, 0 5" fill={CONNECTOR_COLORS.fault}>
        <animate
          attributeName="opacity"
          values="0.7;1;0.7"
          dur="2s"
          repeatCount="indefinite"
        />
      </polygon>
    </marker>

    {/* GoTo arrow (blue) */}
    <marker
      id="arrow-blue"
      markerWidth="6"
      markerHeight="5"
      refX="5"
      refY="2.5"
      orient="auto"
    >
      <polygon points="0 0, 6 2.5, 0 5" fill={CONNECTOR_COLORS.goto} />
    </marker>

    {/* Highlighted arrow */}
    <marker
      id="arrow-highlight"
      markerWidth="6"
      markerHeight="5"
      refX="5"
      refY="2.5"
      orient="auto"
    >
      <polygon points="0 0, 6 2.5, 0 5" fill={CONNECTOR_COLORS.highlight} />
    </marker>
  </defs>
);

export default EdgeMarkers;
