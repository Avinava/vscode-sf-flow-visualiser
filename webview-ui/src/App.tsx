import React, { useState, useEffect, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  FileCode,
  Layout,
  Info,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronLeftCircle,
  ChevronRightCircle,
  Circle,
} from "lucide-react";

// Import from modular structure
import { FlowNode, FlowEdge, ParsedFlow } from "./types";
import { autoLayout } from "./layout";
import { parseFlowXML } from "./parser";
import { NODE_CONFIG, NODE_WIDTH, NODE_HEIGHT, GRID_H_GAP } from "./constants";
// EdgeRenderer and EdgeMarkers available in ./components for future refactoring

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode =
  typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

// Demo XML for testing
const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>57.0</apiVersion>
    <label>Sample Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector><targetReference>Get_Records</targetReference></connector>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <recordLookups>
        <name>Get_Records</name>
        <label>Get Records</label>
        <locationX>176</locationX>
        <locationY>150</locationY>
        <connector><targetReference>Check_Condition</targetReference></connector>
        <object>Contact</object>
    </recordLookups>
    <decisions>
        <name>Check_Condition</name>
        <label>Check Condition</label>
        <locationX>176</locationX>
        <locationY>280</locationY>
        <defaultConnector><targetReference>Update_Record</targetReference></defaultConnector>
        <defaultConnectorLabel>No Match</defaultConnectorLabel>
        <rules>
            <name>Match_Found</name>
            <conditionLogic>and</conditionLogic>
            <connector><targetReference>Create_Record</targetReference></connector>
            <label>Match Found</label>
        </rules>
    </decisions>
    <recordCreates>
        <name>Create_Record</name>
        <label>Create Record</label>
        <locationX>50</locationX>
        <locationY>450</locationY>
        <object>Task</object>
    </recordCreates>
    <recordUpdates>
        <name>Update_Record</name>
        <label>Update Record</label>
        <locationX>300</locationX>
        <locationY>450</locationY>
    </recordUpdates>
</Flow>`;

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [xmlInput, setXmlInput] = useState(DEMO_XML);
  const [parsedData, setParsedData] = useState<ParsedFlow>({
    nodes: [],
    edges: [],
    metadata: {},
  });
  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [autoLayoutEnabled, setAutoLayoutEnabled] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flowFileName, setFlowFileName] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // VS Code message handler
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.command === "loadXml") {
        setXmlInput(e.data.payload);
        if (e.data.fileName) setFlowFileName(e.data.fileName);
        setSelectedNode(null);
        setPan({ x: 0, y: 0 });
        setScale(0.9);
      }
    };
    window.addEventListener("message", handler);
    if (vscode) vscode.postMessage({ command: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  // Parse XML when input changes
  useEffect(() => {
    try {
      const { nodes, edges, metadata } = parseFlowXML(xmlInput);
      if (autoLayoutEnabled && nodes.length > 0) {
        setParsedData({ nodes: autoLayout(nodes, edges), edges, metadata });
      } else {
        setParsedData({ nodes, edges, metadata });
      }
    } catch (err) {
      console.error("Parse error:", err);
    }
  }, [xmlInput, autoLayoutEnabled]);

  // Canvas interactions - use document-level events for reliable dragging
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".flow-node")) return;
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setPan((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Scroll to zoom (no modifier needed)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(0.2, s + delta), 2));
  };

  // Render edges - Salesforce-style connectors
  // Key insight: Salesforce draws branch connectors with a horizontal "branch line"
  // that spreads from the parent, with each child's connector dropping down from it
  // Also draws "merge lines" where multiple branches converge to the same node
  const renderEdges = () => {
    // Group edges by source and target to detect branching and merging
    const edgesBySource = new Map<string, FlowEdge[]>();
    const edgesByTarget = new Map<string, FlowEdge[]>();
    parsedData.edges.forEach((edge) => {
      const sourceList = edgesBySource.get(edge.source) || [];
      sourceList.push(edge);
      edgesBySource.set(edge.source, sourceList);

      const targetList = edgesByTarget.get(edge.target) || [];
      targetList.push(edge);
      edgesByTarget.set(edge.target, targetList);
    });

    // Identify which sources are branch nodes (DECISION, WAIT, LOOP with multiple outputs)
    const branchNodes = new Set<string>();
    parsedData.nodes.forEach((n) => {
      if (n.type === "DECISION" || n.type === "WAIT" || n.type === "LOOP") {
        branchNodes.add(n.id);
      }
    });

    // Identify merge points (nodes with multiple incoming non-fault edges)
    const mergeNodes = new Set<string>();
    edgesByTarget.forEach((edges, targetId) => {
      const normalEdges = edges.filter(
        (e) => e.type !== "fault" && e.type !== "fault-end"
      );
      if (normalEdges.length > 1) {
        mergeNodes.add(targetId);
      }
    });

    const rendered: JSX.Element[] = [];
    const handledEdges = new Set<string>(); // Track edges already rendered

    // First, render branch "spread lines" for decision/wait nodes
    branchNodes.forEach((nodeId) => {
      const srcNode = parsedData.nodes.find((n) => n.id === nodeId);
      if (!srcNode) return;

      const edges = edgesBySource.get(nodeId) || [];
      // Filter to only normal branch edges (not fault)
      let branchEdges = edges.filter(
        (e) =>
          e.type !== "fault" && e.type !== "fault-end" && e.type !== "loop-end"
      );

      if (branchEdges.length > 1 || srcNode.type === "LOOP") {
        // Sort branches: rules/named on left, default on right (same as layout)
        if (srcNode.type === "DECISION" || srcNode.type === "WAIT") {
          branchEdges = [...branchEdges].sort((a, b) => {
            const aIsDefault =
              a.label?.toLowerCase().includes("default") ||
              a.label === "Other" ||
              a.id?.includes("-def");
            const bIsDefault =
              b.label?.toLowerCase().includes("default") ||
              b.label === "Other" ||
              b.id?.includes("-def");
            if (aIsDefault && !bIsDefault) return 1;
            if (!aIsDefault && bIsDefault) return -1;
            return 0;
          });
        }

        // This is a branching point - draw the horizontal branch line
        const srcCenterX = srcNode.x + srcNode.width / 2;
        const srcBottomY = srcNode.y + srcNode.height;

        // Calculate branch positions based on equal spacing, not target positions
        // This ensures proper visual spread even when branches go directly to merge
        const numBranches = branchEdges.length;
        const COL_WIDTH = NODE_WIDTH + GRID_H_GAP; // Same as layout
        const totalWidth = numBranches * COL_WIDTH;
        const startX = srcCenterX - totalWidth / 2 + COL_WIDTH / 2;

        // Build branch positions - use calculated positions for spread, actual target for Y
        const branchPositions = branchEdges
          .map((edge, idx) => {
            const tgt = parsedData.nodes.find((n) => n.id === edge.target);
            if (!tgt) return null;

            // Calculate the X position for this branch based on index (spread evenly)
            const branchX = startX + idx * COL_WIDTH;

            // Check if multiple branches go to same target (merge point)
            // If so, each branch needs its own drop position
            const isMergeTarget = mergeNodes.has(edge.target);

            return {
              edge,
              branchX, // Where the branch connector drops from
              targetX: tgt.x + tgt.width / 2, // Where the target node actually is
              targetY: tgt.y,
              isMergeTarget,
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        if (branchPositions.length > 0) {
          // Calculate branch line Y position (fixed distance from source)
          const branchLineY = srcBottomY + 35;

          // Find leftmost and rightmost branch drop positions
          const branchXs = branchPositions.map((t) => t.branchX);
          const minX = Math.min(...branchXs);
          const maxX = Math.max(...branchXs);

          // Draw horizontal branch line spanning all branches
          rendered.push(
            <path
              key={`branch-line-${nodeId}`}
              d={`M ${minX} ${branchLineY} L ${maxX} ${branchLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw vertical connector from source to branch line
          rendered.push(
            <path
              key={`branch-stem-${nodeId}`}
              d={`M ${srcCenterX} ${srcBottomY} L ${srcCenterX} ${branchLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw connectors from branch line to each target
          // Collect merge branch info to draw merge line afterward
          const mergeBranches: {
            branchX: number;
            targetX: number;
            targetY: number;
            targetId: string;
          }[] = [];
          const cornerRadius = 12; // Consistent rounded corners

          branchPositions.forEach(
            ({ edge, branchX, targetX, targetY, isMergeTarget }) => {
              handledEdges.add(edge.id);

              // If branch goes to a merge point and branch position differs from target,
              // draw path: down from branchX, then curve to center
              if (isMergeTarget && Math.abs(branchX - targetX) > 5) {
                // Calculate merge line Y (above the target)
                const mergeLineY = targetY - 35;

                // Collect for merge line drawing
                mergeBranches.push({
                  branchX,
                  targetX,
                  targetY,
                  targetId: edge.target,
                });

                // Direction: left or right toward center
                const goingRight = targetX > branchX;
                const sign = goingRight ? 1 : -1;

                // Draw path with rounded corner at the turn
                const path = `M ${branchX} ${branchLineY} 
                           L ${branchX} ${mergeLineY - cornerRadius}
                           Q ${branchX} ${mergeLineY}, ${branchX + sign * cornerRadius} ${mergeLineY}
                           L ${targetX} ${mergeLineY}`;

                rendered.push(
                  <g key={`branch-drop-${edge.id}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={2}
                    />
                    {/* Label at branch drop point */}
                    {edge.label && (
                      <foreignObject
                        x={branchX - 60}
                        y={branchLineY - 22}
                        width={120}
                        height={24}
                        style={{ overflow: "visible" }}
                      >
                        <div className="text-[10px] px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded-full text-center truncate shadow-sm max-w-[110px] mx-auto">
                          {edge.label}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              } else {
                // Regular branch - check if we need orthogonal routing
                const dx = targetX - branchX;

                if (Math.abs(dx) < 5) {
                  // Straight vertical line
                  rendered.push(
                    <g key={`branch-drop-${edge.id}`}>
                      <path
                        d={`M ${branchX} ${branchLineY} L ${targetX} ${targetY}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                      />
                      {edge.label && (
                        <foreignObject
                          x={branchX - 60}
                          y={branchLineY - 22}
                          width={120}
                          height={24}
                          style={{ overflow: "visible" }}
                        >
                          <div className="text-[10px] px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded-full text-center truncate shadow-sm max-w-[110px] mx-auto">
                            {edge.label}
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                } else {
                  // Orthogonal routing with rounded corners
                  const sign = dx > 0 ? 1 : -1;
                  const midY = branchLineY + (targetY - branchLineY) / 2;

                  const path = `M ${branchX} ${branchLineY}
                             L ${branchX} ${midY - cornerRadius}
                             Q ${branchX} ${midY}, ${branchX + sign * cornerRadius} ${midY}
                             L ${targetX - sign * cornerRadius} ${midY}
                             Q ${targetX} ${midY}, ${targetX} ${midY + cornerRadius}
                             L ${targetX} ${targetY}`;

                  rendered.push(
                    <g key={`branch-drop-${edge.id}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                      />
                      {edge.label && (
                        <foreignObject
                          x={branchX - 60}
                          y={branchLineY - 22}
                          width={120}
                          height={24}
                          style={{ overflow: "visible" }}
                        >
                          <div className="text-[10px] px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded-full text-center truncate shadow-sm max-w-[110px] mx-auto">
                            {edge.label}
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                }
              }
            }
          );

          // Draw the final arrow from merge line to target for merge branches
          if (mergeBranches.length > 0) {
            const { targetX, targetY } = mergeBranches[0];
            const mergeLineY = targetY - 35;

            // Draw single arrow from merge line center down to target
            rendered.push(
              <path
                key={`merge-arrow-${nodeId}`}
                d={`M ${targetX} ${mergeLineY} L ${targetX} ${targetY}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
            );
          }
        }
      }
    });

    // Render merge lines for nodes with multiple incoming edges FROM THE SAME DECISION
    // This is the "diamond" pattern where branches from one decision converge
    mergeNodes.forEach((targetId) => {
      const tgtNode = parsedData.nodes.find((n) => n.id === targetId);
      if (!tgtNode) return;

      const incomingEdges = (edgesByTarget.get(targetId) || []).filter(
        (e) =>
          e.type !== "fault" &&
          e.type !== "fault-end" &&
          !handledEdges.has(e.id)
      );

      // Only draw merge lines if we have 2+ unhandled incoming edges
      // AND they come from different nodes (not already part of branch rendering)
      if (incomingEdges.length > 1) {
        const tgtCenterX = tgtNode.x + tgtNode.width / 2;
        const tgtTopY = tgtNode.y;
        const cornerRadius = 12;

        // Get source positions for unhandled edges
        const sourcePositions = incomingEdges
          .map((e) => {
            const src = parsedData.nodes.find((n) => n.id === e.source);
            return src
              ? { edge: e, x: src.x + src.width / 2, y: src.y + src.height }
              : null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        // Check if all sources are at the same Y level (siblings from same parent)
        const sourceYs = new Set(
          sourcePositions.map((s) => Math.round(s.y / 10) * 10)
        ); // Round to reduce precision issues
        const allSameLevel = sourceYs.size === 1;

        if (sourcePositions.length > 1 && allSameLevel) {
          // Calculate merge line Y position (fixed distance above target)
          const mergeLineY = tgtTopY - 35;

          // Find leftmost and rightmost sources
          const xs = sourcePositions.map((s) => s.x);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);

          // Draw horizontal merge line
          rendered.push(
            <path
              key={`merge-line-${targetId}`}
              d={`M ${minX} ${mergeLineY} L ${maxX} ${mergeLineY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );

          // Draw vertical connector from merge line to target
          rendered.push(
            <path
              key={`merge-stem-${targetId}`}
              d={`M ${tgtCenterX} ${mergeLineY} L ${tgtCenterX} ${tgtTopY}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />
          );

          // Draw connectors from each source to the merge line with rounded corners
          sourcePositions.forEach(({ edge, x, y }) => {
            handledEdges.add(edge.id);
            const dx = tgtCenterX - x;

            if (Math.abs(dx) < 5) {
              // Straight vertical line to merge line
              rendered.push(
                <path
                  key={`merge-drop-${edge.id}`}
                  d={`M ${x} ${y} L ${x} ${mergeLineY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                />
              );
            } else {
              // Curved path to merge line
              const sign = dx > 0 ? 1 : -1;
              const path = `M ${x} ${y}
                           L ${x} ${mergeLineY - cornerRadius}
                           Q ${x} ${mergeLineY}, ${x + sign * cornerRadius} ${mergeLineY}`;

              rendered.push(
                <path
                  key={`merge-drop-${edge.id}`}
                  d={path}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                />
              );
            }
          });
        }
      }
    });

    // Now render all other edges (non-branch, non-merge connectors)
    parsedData.edges.forEach((edge) => {
      // Skip edges already handled by branch or merge rendering
      if (handledEdges.has(edge.id)) {
        return;
      }

      const src = parsedData.nodes.find((n) => n.id === edge.source);
      const tgt = parsedData.nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) return;

      const srcCenterX = src.x + src.width / 2;
      const srcBottomY = src.y + src.height;
      const srcRightX = src.x + src.width;
      const srcCenterY = src.y + src.height / 2;

      const tgtCenterX = tgt.x + tgt.width / 2;
      const tgtTopY = tgt.y;
      const tgtLeftX = tgt.x;
      const tgtCenterY = tgt.y + tgt.height / 2;

      const isFault = edge.type === "fault";
      const isFaultEnd = edge.type === "fault-end";
      const isLoopNext = edge.type === "loop-next";
      const isLoopEnd = edge.type === "loop-end";

      // Skip branch edges that weren't captured (fallback check)
      const srcEdges = edgesBySource.get(edge.source) || [];
      const isBranchChild =
        branchNodes.has(edge.source) &&
        !isFault &&
        !isFaultEnd &&
        !isLoopEnd &&
        srcEdges.filter(
          (e) =>
            e.type !== "fault" &&
            e.type !== "fault-end" &&
            e.type !== "loop-end"
        ).length > 1;

      // For loop nodes, loop-next is handled as a branch
      const isLoopBranch = src.type === "LOOP" && isLoopNext;

      if (isBranchChild || isLoopBranch) {
        return; // Already rendered as part of branch
      }

      // Check if this is a loop-back connector (target is above source)
      const isLoopBack =
        !isFault &&
        !isFaultEnd &&
        !isLoopNext &&
        !isLoopEnd &&
        tgtTopY < srcBottomY;

      let path: string;
      const showAsRed = isFault || isFaultEnd;

      // Fault connector routing constants
      // Fault connectors exit horizontally from the right side of nodes
      const FAULT_HORIZONTAL_OFFSET = 50;

      if (isFaultEnd) {
        // For fault-end: draw a perfectly horizontal straight line
        // Use source's center Y for both endpoints to guarantee straight line
        const straightY = srcCenterY;
        path = `M ${srcRightX} ${straightY} L ${tgtLeftX} ${straightY}`;
      } else if (isFault) {
        // Fault connectors: exit from right side with smart routing
        // Check if the horizontal path would overlap with existing main flow lines
        const cornerRadius = 12;

        // Calculate base horizontal offset - increase if there might be overlaps
        // Check if there are any nodes between source and target horizontally
        const potentialOverlap = parsedData.nodes.some((n) => {
          if (n.id === src.id || n.id === tgt.id) return false;
          const nCenterX = n.x + n.width / 2;
          const nCenterY = n.y + n.height / 2;
          // Check if this node is in the horizontal corridor between src and tgt
          const inHorizontalRange = nCenterX > srcRightX && nCenterX < tgtLeftX;
          const inVerticalRange = Math.abs(nCenterY - srcCenterY) < NODE_HEIGHT;
          return inHorizontalRange && inVerticalRange;
        });

        // Use larger offset if potential overlap detected
        const horizontalEndX =
          srcRightX +
          (potentialOverlap
            ? FAULT_HORIZONTAL_OFFSET * 1.5
            : FAULT_HORIZONTAL_OFFSET);

        // Check if target and source are at roughly same Y level
        if (Math.abs(tgtCenterY - srcCenterY) < 15) {
          // Nearly horizontal - draw straight line
          path = `M ${srcRightX} ${srcCenterY} L ${tgtLeftX} ${tgtCenterY}`;
        } else if (tgtCenterY > srcCenterY) {
          // Target is below - route down and right with smooth curves
          path = `M ${srcRightX} ${srcCenterY} 
                  L ${horizontalEndX - cornerRadius} ${srcCenterY}
                  Q ${horizontalEndX} ${srcCenterY}, ${horizontalEndX} ${srcCenterY + cornerRadius}
                  L ${horizontalEndX} ${tgtCenterY - cornerRadius}
                  Q ${horizontalEndX} ${tgtCenterY}, ${horizontalEndX + cornerRadius} ${tgtCenterY}
                  L ${tgtLeftX} ${tgtCenterY}`;
        } else {
          // Target is above - route up and right with smooth curves
          path = `M ${srcRightX} ${srcCenterY} 
                  L ${horizontalEndX - cornerRadius} ${srcCenterY}
                  Q ${horizontalEndX} ${srcCenterY}, ${horizontalEndX} ${srcCenterY - cornerRadius}
                  L ${horizontalEndX} ${tgtCenterY + cornerRadius}
                  Q ${horizontalEndX} ${tgtCenterY}, ${horizontalEndX + cornerRadius} ${tgtCenterY}
                  L ${tgtLeftX} ${tgtCenterY}`;
        }
      } else if (isLoopBack) {
        // Loop-back connector: go left and up
        const offsetX = Math.min(
          50,
          Math.abs(srcCenterX - tgtCenterX) / 2 + 30
        );
        const leftX = Math.min(srcCenterX, tgtCenterX) - offsetX;
        const cornerRadius = 15;
        path = `M ${srcCenterX} ${srcBottomY} 
                L ${srcCenterX} ${srcBottomY + 20} 
                Q ${srcCenterX} ${srcBottomY + 20 + cornerRadius}, ${srcCenterX - cornerRadius} ${srcBottomY + 20 + cornerRadius}
                L ${leftX + cornerRadius} ${srcBottomY + 20 + cornerRadius}
                Q ${leftX} ${srcBottomY + 20 + cornerRadius}, ${leftX} ${srcBottomY + 20}
                L ${leftX} ${tgtTopY + 20}
                Q ${leftX} ${tgtTopY - cornerRadius}, ${leftX + cornerRadius} ${tgtTopY - cornerRadius}
                L ${tgtCenterX - cornerRadius} ${tgtTopY - cornerRadius}
                Q ${tgtCenterX} ${tgtTopY - cornerRadius}, ${tgtCenterX} ${tgtTopY}`;
      } else if (Math.abs(tgtCenterX - srcCenterX) < 5) {
        // Straight vertical line
        path = `M ${srcCenterX} ${srcBottomY} L ${tgtCenterX} ${tgtTopY}`;
      } else {
        // Orthogonal routing with rounded corners
        const verticalMid = srcBottomY + (tgtTopY - srcBottomY) / 2;
        const cornerRadius = 12;
        const dx = tgtCenterX - srcCenterX;
        const sign = dx > 0 ? 1 : -1;

        if (Math.abs(tgtTopY - srcBottomY) < 40) {
          path = `M ${srcCenterX} ${srcBottomY} 
                  L ${srcCenterX} ${srcBottomY + 15}
                  Q ${srcCenterX} ${srcBottomY + 25}, ${srcCenterX + sign * 10} ${srcBottomY + 25}
                  L ${tgtCenterX - sign * 10} ${srcBottomY + 25}
                  Q ${tgtCenterX} ${srcBottomY + 25}, ${tgtCenterX} ${srcBottomY + 35}
                  L ${tgtCenterX} ${tgtTopY}`;
        } else {
          path = `M ${srcCenterX} ${srcBottomY} 
                  L ${srcCenterX} ${verticalMid - cornerRadius}
                  Q ${srcCenterX} ${verticalMid}, ${srcCenterX + sign * cornerRadius} ${verticalMid}
                  L ${tgtCenterX - sign * cornerRadius} ${verticalMid}
                  Q ${tgtCenterX} ${verticalMid}, ${tgtCenterX} ${verticalMid + cornerRadius}
                  L ${tgtCenterX} ${tgtTopY}`;
        }
      }

      // Calculate label position
      let labelX = (srcCenterX + tgtCenterX) / 2;
      let labelY = srcBottomY + 20;

      if (isFault || isFaultEnd) {
        // Position fault label on the line, centered between source and target
        labelX = (srcRightX + tgtLeftX) / 2;
        labelY = srcCenterY - 12;
      } else if (isLoopBack) {
        // For Each label - position on the left vertical line segment
        const offsetX = Math.min(
          50,
          Math.abs(srcCenterX - tgtCenterX) / 2 + 30
        );
        const leftX = Math.min(srcCenterX, tgtCenterX) - offsetX;
        labelX = leftX;
        labelY = (srcBottomY + tgtTopY) / 2;
      } else if (isLoopEnd) {
        // After Last label - position on the line, between source and target
        labelX = (srcCenterX + tgtCenterX) / 2;
        labelY = srcBottomY + (tgtTopY - srcBottomY) / 2;
      } else if (isLoopNext) {
        // For Each label - position on the line going left
        labelX = (srcCenterX + tgtCenterX) / 2;
        labelY = srcBottomY + (tgtTopY - srcBottomY) / 2;
      }

      rendered.push(
        <g key={edge.id}>
          <path
            d={path}
            fill="none"
            stroke={showAsRed ? "#ef4444" : "#94a3b8"}
            strokeWidth={2}
            strokeDasharray={showAsRed ? "6,4" : undefined}
            markerEnd={showAsRed ? "url(#arrow-red)" : "url(#arrow)"}
          />
          {edge.label && (
            <foreignObject
              x={labelX - 50}
              y={labelY - 8}
              width={100}
              height={30}
              style={{ overflow: "visible" }}
            >
              <div
                className={`text-[10px] px-2 py-0.5 rounded-full text-center truncate border shadow-sm mx-auto
                ${showAsRed ? "bg-red-500 text-white border-red-600 font-medium" : "bg-white text-slate-600 border-slate-200 max-w-[90px]"}`}
              >
                {edge.label}
              </div>
            </foreignObject>
          )}
        </g>
      );
    });

    return rendered;
  };

  const title =
    parsedData.metadata.label ||
    flowFileName?.replace(".flow-meta.xml", "") ||
    "Flow Visualizer";

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans text-sm">
      {/* SIDEBAR */}
      <div
        className={`bg-white border-r border-slate-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
        style={{ width: sidebarOpen ? 320 : 0 }}
      >
        {/* Header */}
        <div className="h-14 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center px-4 flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
            <FileCode className="text-white w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate text-sm">
              {title}
            </div>
            {parsedData.metadata.apiVersion && (
              <div className="text-[10px] text-blue-200">
                API v{parsedData.metadata.apiVersion}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-4 text-xs flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-medium text-slate-700">
              {parsedData.nodes.length}
            </span>
            <span className="text-slate-500">nodes</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-medium text-slate-700">
              {parsedData.edges.length}
            </span>
            <span className="text-slate-500">connections</span>
          </span>
        </div>

        {/* Details Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedNode ? (
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      NODE_CONFIG[selectedNode.type]?.color || "#64748b",
                  }}
                >
                  {React.createElement(
                    NODE_CONFIG[selectedNode.type]?.icon || Circle,
                    { size: 20, className: "text-white" }
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 leading-tight">
                    {selectedNode.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {NODE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    API Name
                  </div>
                  <div className="font-mono text-xs bg-slate-100 px-2 py-1.5 rounded border border-slate-200 break-all">
                    {selectedNode.id}
                  </div>
                </div>

                {typeof selectedNode.data.object === "string" &&
                  selectedNode.data.object && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Object
                      </div>
                      <div className="text-xs bg-slate-100 px-2 py-1.5 rounded border border-slate-200">
                        {selectedNode.data.object}
                      </div>
                    </div>
                  )}

                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Connections
                  </div>
                  <div className="space-y-1">
                    {parsedData.edges
                      .filter((e) => e.source === selectedNode.id)
                      .map((e) => (
                        <div
                          key={e.id}
                          className={`text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border
                        ${e.type === "fault" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                        >
                          <ChevronRight size={12} />
                          <span className="truncate flex-1">{e.target}</span>
                          {e.label && (
                            <span className="text-[10px] text-slate-400">
                              ({e.label})
                            </span>
                          )}
                        </div>
                      ))}
                    {parsedData.edges
                      .filter((e) => e.target === selectedNode.id)
                      .map((e) => (
                        <div
                          key={e.id}
                          className="text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border bg-slate-50 text-slate-600 border-slate-200"
                        >
                          <ChevronLeft size={12} />
                          <span className="truncate">{e.source}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {typeof selectedNode.data.xmlElement === "string" &&
                  selectedNode.data.xmlElement && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        XML
                      </div>
                      <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-40 font-mono">
                        {selectedNode.data.xmlElement.slice(0, 600)}
                        {selectedNode.data.xmlElement.length > 600 && "..."}
                      </pre>
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
              <Info className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-center text-xs">
                Select a node to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SIDEBAR TOGGLE */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 rounded-r-lg shadow-md p-1.5 hover:bg-slate-50 transition-all"
        style={{ left: sidebarOpen ? 308 : 0 }}
      >
        {sidebarOpen ? (
          <ChevronLeftCircle size={20} className="text-slate-500" />
        ) : (
          <ChevronRightCircle size={20} className="text-slate-500" />
        )}
      </button>

      {/* CANVAS AREA */}
      <div className="flex-1 relative overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white rounded-xl shadow-lg border border-slate-200 px-2 py-1.5 flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.15, 2))}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn size={16} className="text-slate-600" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.2))}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut size={16} className="text-slate-600" />
          </button>
          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setScale(0.9);
            }}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
            title="Reset"
          >
            <Home size={16} className="text-slate-600" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <button
            onClick={() => setAutoLayoutEnabled(!autoLayoutEnabled)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors
              ${autoLayoutEnabled ? "bg-blue-100 text-blue-700" : "hover:bg-slate-100 text-slate-600"}`}
          >
            <Layout size={14} />
            Auto-Layout
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute top-4 right-4 z-10 bg-white px-3 py-1.5 rounded-lg shadow border border-slate-200 text-xs font-medium text-slate-600">
          {Math.round(scale * 100)}%
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="w-full h-full cursor-grab select-none"
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          style={{
            backgroundImage:
              "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
              width: "4000px",
              height: "4000px",
            }}
          >
            {/* SVG for edges */}
            <svg className="absolute top-0 left-0 w-1 h-1 overflow-visible pointer-events-none">
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-red"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                </marker>
              </defs>
              {renderEdges()}
            </svg>

            {/* Nodes */}
            {parsedData.nodes.map((node) => {
              const config = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;
              const isSelected = selectedNode?.id === node.id;

              // Special rendering for END nodes - simple red circle
              if (node.type === "END") {
                const isFaultPath = node.data.isFaultPath === true;

                // For fault-path END nodes, position horizontally
                if (isFaultPath) {
                  return (
                    <div
                      key={node.id}
                      className="flow-node absolute flex flex-row items-center"
                      style={{ left: node.x, top: node.y, width: node.width }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                    >
                      {/* End circle */}
                      <div
                        className={`
                        w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
                        shadow-md transition-all
                        ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
                      `}
                      >
                        <Circle size={16} className="text-white" fill="white" />
                      </div>

                      {/* Label */}
                      <div className="text-xs font-medium text-slate-600 ml-2">
                        End
                      </div>
                    </div>
                  );
                }

                // Normal END node (vertical connection from above)
                return (
                  <div
                    key={node.id}
                    className="flow-node absolute flex flex-col items-center"
                    style={{ left: node.x, top: node.y, width: node.width }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                  >
                    {/* Top connector dot */}
                    <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow mb-2"></div>

                    {/* End circle */}
                    <div
                      className={`
                      w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
                      shadow-md transition-all
                      ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
                    `}
                    >
                      <Circle size={16} className="text-white" fill="white" />
                    </div>

                    {/* Label */}
                    <div className="text-xs font-medium text-slate-600 mt-1.5">
                      End
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  className="flow-node absolute"
                  style={{ left: node.x, top: node.y, width: node.width }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                >
                  {/* Top connector dot */}
                  {node.type !== "START" && (
                    <div className="flex justify-center -mb-1.5 relative z-10">
                      <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow"></div>
                    </div>
                  )}

                  {/* Node card */}
                  <div
                    className={`
                    rounded-xl border-2 shadow-md cursor-pointer overflow-hidden transition-all
                    ${isSelected ? "border-blue-500 shadow-lg ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300 hover:shadow-lg"}
                    bg-white
                  `}
                  >
                    <div className="flex items-stretch">
                      {/* Icon */}
                      <div
                        className="w-10 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      >
                        {React.createElement(config.icon, {
                          size: 16,
                          className: "text-white",
                        })}
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-3 py-2 min-w-0">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                          {config.label}
                        </div>
                        <div
                          className="text-sm font-semibold text-slate-800 truncate"
                          title={node.label}
                        >
                          {node.label}
                        </div>
                        {node.type === "START" &&
                          typeof node.data.object === "string" &&
                          node.data.object && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Object: {node.data.object}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom connector dot */}
                  <div className="flex justify-center -mt-1.5 relative z-10">
                    <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
