/**
 * Flow Animation Component
 *
 * Provides CSS animation definitions for flow visualization.
 * The animated overlay is rendered directly in EdgeRenderer using
 * the same path calculations as the actual edges.
 */

import React from "react";
import { useTheme } from "../../context";
import { CONNECTOR_COLORS } from "../../constants";

/**
 * Provides CSS animation styles for flow visualization.
 * This component only renders the style definitions.
 */
export const FlowAnimation: React.FC = () => {
  const { isDark } = useTheme();
  const animationColor = isDark ? "#60a5fa" : "#3b82f6";
  const faultColor = isDark
    ? CONNECTOR_COLORS.faultDark
    : CONNECTOR_COLORS.fault;

  return (
    <defs>
      {/* Subtle glow filter for fault spark */}
      <filter
        id="fault-spark-glow"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feFlood floodColor={faultColor} floodOpacity="0.6" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

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
