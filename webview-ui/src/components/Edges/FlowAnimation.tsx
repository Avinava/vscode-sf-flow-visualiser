/**
 * Flow Animation Component
 *
 * Provides CSS animation definitions for flow visualization.
 * The animated overlay is rendered directly in EdgeRenderer using
 * the same path calculations as the actual edges.
 */

import React from "react";
import { useTheme } from "../../context";

/**
 * Provides CSS animation styles for flow visualization.
 * This component only renders the style definitions.
 */
export const FlowAnimation: React.FC = () => {
  const { isDark } = useTheme();
  const animationColor = isDark ? "#60a5fa" : "#3b82f6";

  return (
    <defs>
      <style>
        {`
          @keyframes flow-dash-forward {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: -24;
            }
          }
          
          @keyframes flow-dash-reverse {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: 24;
            }
          }
          
          .flow-animated-path {
            stroke: ${animationColor};
            stroke-width: 3;
            stroke-dasharray: 6 18;
            stroke-linecap: round;
            fill: none;
            opacity: 0.8;
            animation: flow-dash-forward 0.6s linear infinite;
            pointer-events: none;
          }
          
          .flow-animated-path-reverse {
            stroke: ${animationColor};
            stroke-width: 3;
            stroke-dasharray: 6 18;
            stroke-linecap: round;
            fill: none;
            opacity: 0.8;
            animation: flow-dash-reverse 0.6s linear infinite;
            pointer-events: none;
          }
        `}
      </style>
    </defs>
  );
};

export default FlowAnimation;
