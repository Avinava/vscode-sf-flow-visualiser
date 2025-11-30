/**
 * Edge Label Component
 *
 * Renders labels on flow connectors as styled badges.
 * Based on Salesforce's connector-badge styling from alcStyles.js
 */

import React from "react";

export interface EdgeLabelProps {
  x: number;
  y: number;
  label: string;
  isFault?: boolean;
  isGoTo?: boolean;
  isHighlighted?: boolean;
}

/**
 * Styled badge label for edges
 */
export const EdgeLabel: React.FC<EdgeLabelProps> = ({
  x,
  y,
  label,
  isFault = false,
  isGoTo = false,
  isHighlighted = false,
}) => (
  <foreignObject
    x={x - 85}
    y={y - 12}
    width={170}
    height={24}
    style={{ overflow: "visible" }}
  >
    <div
      className={`text-[10px] px-2.5 py-0.5 rounded-full text-center truncate border shadow-sm mx-auto font-medium
        ${
          isFault
            ? "bg-red-500 text-white border-red-600"
            : isGoTo
              ? "bg-blue-50 text-blue-600 border-blue-200"
              : isHighlighted
                ? "bg-blue-50 text-blue-700 border-blue-300 shadow"
                : "bg-white text-slate-600 border-slate-200"
        }`}
      style={{ width: "fit-content", margin: "0 auto", maxWidth: "160px" }}
    >
      {label}
    </div>
  </foreignObject>
);

export default EdgeLabel;
