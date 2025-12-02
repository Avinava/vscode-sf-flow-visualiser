/**
 * Flow Parser Hook
 *
 * Manages parsing of Salesforce Flow XML into visualization data.
 * Handles XML parsing, auto-layout, and maintains parsed flow state.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import type { ParsedFlow } from "../types";
import { parseFlowXML } from "../parser";
import { autoLayoutWithFaultLanes, type FaultLaneInfo } from "../layout";

// Demo XML for testing when no file is loaded
const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>57.0</apiVersion>
    <description>This flow automatically creates a task when a new Account is created. It checks for matching contacts and creates records accordingly.</description>
    <environments>Default</environments>
    <label>Sample Account Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>
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

export interface UseFlowParserOptions {
  /** Initial XML to parse (defaults to demo) */
  initialXml?: string;
  /** Whether auto-layout is enabled (default: true) */
  autoLayoutEnabled?: boolean;
}

export interface UseFlowParserResult {
  /** Current XML input */
  xmlInput: string;
  /** Set new XML input */
  setXmlInput: (xml: string) => void;
  /** Parsed flow data */
  parsedData: ParsedFlow;
  /** Flow file name */
  fileName: string;
  /** Set flow file name */
  setFileName: (name: string) => void;
  /** Whether auto-layout is enabled */
  autoLayoutEnabled: boolean;
  /** Toggle auto-layout */
  setAutoLayoutEnabled: (enabled: boolean) => void;
  /** Load a new flow from XML */
  loadFlow: (xml: string, fileName?: string) => void;
  /** Map of node IDs that are targets of GoTo connectors with their counts */
  goToTargetCounts: Map<string, number>;
  /** Pre-calculated fault lane information for consistent connector routing */
  faultLanes: Map<string, FaultLaneInfo>;
  /** Parsing error if any */
  error: Error | null;
}

const EMPTY_PARSED_FLOW: ParsedFlow = {
  nodes: [],
  edges: [],
  metadata: {},
};

/**
 * Hook for parsing and managing Salesforce Flow data
 *
 * @param options - Configuration options
 * @returns Parsed flow state and management functions
 */
export function useFlowParser(
  options: UseFlowParserOptions = {}
): UseFlowParserResult {
  const { initialXml = DEMO_XML, autoLayoutEnabled: initialAutoLayout = true } =
    options;

  const [xmlInput, setXmlInput] = useState(initialXml);
  const [fileName, setFileName] = useState("");
  const [autoLayoutEnabled, setAutoLayoutEnabled] = useState(initialAutoLayout);
  const [parsedData, setParsedData] = useState<ParsedFlow>(EMPTY_PARSED_FLOW);
  const [faultLanes, setFaultLanes] = useState<Map<string, FaultLaneInfo>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  // Parse XML whenever input or auto-layout setting changes
  useEffect(() => {
    try {
      const { nodes, edges, metadata } = parseFlowXML(xmlInput);

      if (autoLayoutEnabled && nodes.length > 0) {
        // Use the enhanced layout function that also returns fault lane info
        const { nodes: layoutedNodes, faultLanes: calculatedFaultLanes } = 
          autoLayoutWithFaultLanes(nodes, edges);
        
        setParsedData({
          nodes: layoutedNodes,
          edges,
          metadata,
          xmlContent: xmlInput, // Store for quality analysis
        });
        setFaultLanes(calculatedFaultLanes);
      } else {
        setParsedData({ nodes, edges, metadata, xmlContent: xmlInput });
        setFaultLanes(new Map());
      }

      setError(null);
    } catch (err) {
      console.error("Parse error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      // Keep previous valid data on error
    }
  }, [xmlInput, autoLayoutEnabled]);

  // Compute GoTo target counts
  const goToTargetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    parsedData.edges.forEach((edge) => {
      if (edge.isGoTo) {
        counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
      }
    });
    return counts;
  }, [parsedData.edges]);

  // Load a new flow
  const loadFlow = useCallback((xml: string, newFileName?: string) => {
    setXmlInput(xml);
    if (newFileName !== undefined) {
      setFileName(newFileName);
    }
  }, []);

  return {
    xmlInput,
    setXmlInput,
    parsedData,
    fileName,
    setFileName,
    autoLayoutEnabled,
    setAutoLayoutEnabled,
    loadFlow,
    goToTargetCounts,
    faultLanes,
    error,
  };
}

export default useFlowParser;
