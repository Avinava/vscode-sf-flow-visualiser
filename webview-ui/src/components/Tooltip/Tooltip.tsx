import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  offset?: number;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "bottom",
  offset = 8,
  delay = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    // Calculate position based on side
    // We'll adjust centering after render if needed, but for now simple calculation
    // Note: To center perfectly we'd need the tooltip dimensions, which we don't have until render.
    // A common trick is to use transform: translate(-50%, ...) in CSS.

    switch (side) {
      case "top":
        top = rect.top - offset;
        left = rect.left + rect.width / 2;
        break;
      case "bottom":
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - offset;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + offset;
        break;
    }

    setPosition({ top, left });
  };

  // Update position on scroll or resize if visible
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isVisible]);

  // Clone child to attach refs and events
  const trigger = React.cloneElement(children, {
    ref: (node: HTMLElement) => {
      // Maintain existing ref if any
      // @ts-ignore
      triggerRef.current = node;
      const { ref } = children as any;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      children.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {trigger}
      {isVisible &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              top: position.top,
              left: position.left,
              transform:
                side === "top"
                  ? "translate(-50%, -100%)"
                  : side === "bottom"
                  ? "translate(-50%, 0)"
                  : side === "left"
                  ? "translate(-100%, -50%)"
                  : "translate(0, -50%)",
            }}
          >
            <div className="px-2 py-1 text-xs font-medium text-white bg-slate-800 dark:bg-slate-700 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 relative">
              {content}
              {/* Arrow */}
              <div
                className={`absolute w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45 ${
                  side === "top"
                    ? "bottom-[-4px] left-1/2 -translate-x-1/2"
                    : side === "bottom"
                    ? "top-[-4px] left-1/2 -translate-x-1/2"
                    : side === "left"
                    ? "right-[-4px] top-1/2 -translate-y-1/2"
                    : "left-[-4px] top-1/2 -translate-y-1/2"
                }`}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
