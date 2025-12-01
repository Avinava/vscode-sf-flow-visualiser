/**
 * Flow Quality Component
 *
 * Displays flow quality violations detected by lightning-flow-scanner
 * in a tabbed interface organized by severity level.
 */

import React, { useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle,
    ExternalLink,
} from "lucide-react";
import type { FlowQualityMetrics } from "../../utils/flow-scanner";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowQualityProps {
    metrics: FlowQualityMetrics | null;
}

type SeverityFilter = "all" | "error" | "warning" | "note";

// ============================================================================
// COMPONENT
// ============================================================================

export const FlowQuality: React.FC<FlowQualityProps> = ({ metrics }) => {
    const [activeFilter, setActiveFilter] = useState<SeverityFilter>("all");

    // Initialize with all violations expanded by default
    const [expandedViolations, setExpandedViolations] = useState<Set<string>>(() => {
        if (!metrics) return new Set();
        return new Set(
            metrics.violations.map((v, idx) => `${v.rule}-${v.elementName}-${idx}`)
        );
    });

    const toggleExpanded = (key: string) => {
        const newExpanded = new Set(expandedViolations);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedViolations(newExpanded);
    };

    if (!metrics) {
        return (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading quality analysis...
            </div>
        );
    }

    const { violations, violationsBySeverity } = metrics;

    // Filter violations based on active severity filter
    const filteredViolations =
        activeFilter === "all"
            ? violations
            : violations.filter((v) => v.severity === activeFilter);

    // Get icon and color for severity
    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case "error":
                return {
                    icon: AlertCircle,
                    color: "text-red-600 dark:text-red-400",
                    bg: "bg-red-50 dark:bg-red-900/20",
                    border: "border-red-200 dark:border-red-800",
                    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                };
            case "warning":
                return {
                    icon: AlertTriangle,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-900/20",
                    border: "border-amber-200 dark:border-amber-800",
                    badge:
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                };
            case "note":
            default:
                return {
                    icon: Info,
                    color: "text-blue-600 dark:text-blue-400",
                    bg: "bg-blue-50 dark:bg-blue-900/20",
                    border: "border-blue-200 dark:border-blue-800",
                    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                };
        }
    };

    // Get human-readable descriptions for rules
    const getRuleDescription = (ruleLabel: string) => {
        const descriptions: Record<string, string> = {
            "Flow Naming Convention": "Flow names should follow a clear naming pattern with a domain/object prefix for better organization and maintainability.",
            "Missing Fault Path": "Elements that interact with external systems or perform database operations should have fault handlers to gracefully handle errors and prevent flow failures.",
            "Missing Null Handler": "Decision elements should explicitly handle null or empty values to prevent unexpected flow behavior and runtime errors.",
            "Cyclomatic Complexity": "High complexity makes flows harder to understand and maintain. Consider breaking complex flows into smaller, reusable subflows.",
            "DML Statement In Loop": "Database operations (Create, Update, Delete) inside loops can hit Salesforce governor limits. Collect records and perform bulk operations outside the loop.",
            "SOQL Query In Loop": "SOQL queries inside loops can hit governor limits (100 queries per transaction). Use Get Records before the loop or collect IDs and query once.",
            "Hardcoded ID": "Hardcoded Salesforce IDs are org-specific and will break when deploying to other environments. Use Custom Metadata Types or Custom Settings instead.",
            "Hardcoded URL": "Hardcoded URLs are environment-specific. Use $API global variables, Named Credentials, or Custom Labels for URLs.",
            "Duplicate DML Operation": "Duplicate database operations between screens can cause  issues if users navigate backward. Use prevent backward navigation or conditional logic.",
            "Outdated API Version": "Using an outdated API version may cause compatibility issues. Update to the latest API version for best performance and new features.",
            "Unconnected Element": "This element is not connected to any flow path. Remove unused elements or connect them properly to keep the flow clean.",
            "Missing Flow Description": "Flow descriptions help other developers understand the purpose and context of the flow. Add a meaningful description.",
            "Copy API Name": "Element names like 'Copy_X_Of_...' indicate copied elements. Rename them to reflect their actual purpose for better readability.",
            "Get Record All Fields": "Selecting all fields violates the principle of least privilege and can impact performance. Specify only the fields you need.",
            "Trigger Order": "assignmentOrder attribute allows you to control the execution sequence of flows. Consider setting explicit priority values.",
            "Same Record Field Updates": "Updating the same record field multiple times is inefficient. Combine updates into a single Record Update element after the decision logic.",
        };
        return descriptions[ruleLabel] || null;
    };

    // Empty state - no violations
    if (violations.length === 0) {
        return (
            <div className="p-4">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400 mb-3" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                        No Issues Found
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        This flow follows all quality best practices
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with summary */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Flow Quality Analysis
                    </h3>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {metrics.totalViolations} issues
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {violationsBySeverity.error > 0 && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded text-xs text-red-700 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="font-semibold">{violationsBySeverity.error}</span>
                        </div>
                    )}
                    {violationsBySeverity.warning > 0 && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded text-xs text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="font-semibold">{violationsBySeverity.warning}</span>
                        </div>
                    )}
                    {violationsBySeverity.note > 0 && (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-400">
                            <Info className="w-3.5 h-3.5" />
                            <span className="font-semibold">{violationsBySeverity.note}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Severity filter tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <button
                    onClick={() => setActiveFilter("all")}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeFilter === "all"
                        ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                >
                    All
                </button>
                {violationsBySeverity.error > 0 && (
                    <button
                        onClick={() => setActiveFilter("error")}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeFilter === "error"
                            ? "text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                    >
                        Errors
                    </button>
                )}
                {violationsBySeverity.warning > 0 && (
                    <button
                        onClick={() => setActiveFilter("warning")}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeFilter === "warning"
                            ? "text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                    >
                        Warnings
                    </button>
                )}
                {violationsBySeverity.note > 0 && (
                    <button
                        onClick={() => setActiveFilter("note")}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeFilter === "note"
                            ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                    >
                        Notes
                    </button>
                )}
            </div>

            {/* Violations list */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-3">
                    {filteredViolations.map((violation, idx) => {
                        const style = getSeverityStyle(violation.severity);
                        const Icon = style.icon;
                        const violationKey = `${violation.rule}-${violation.elementName}-${idx}`;
                        const isExpanded = expandedViolations.has(violationKey);
                        const description = getRuleDescription(violation.ruleLabel);

                        return (
                            <div
                                key={violationKey}
                                className={`${style.bg} ${style.border} border rounded-lg overflow-hidden transition-all shadow-sm`}
                            >
                                {/* Violation header - always visible */}
                                <div
                                    className="p-3 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => description && toggleExpanded(violationKey)}
                                >
                                    <div className="flex items-start gap-3">
                                        <Icon className={`w-4 h-4 ${style.color} flex-shrink-0 mt-0.5`} />
                                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate pr-2">
                                                    {violation.ruleLabel}
                                                </span>
                                                <span
                                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${style.badge} flex-shrink-0`}
                                                >
                                                    {violation.severity}
                                                </span>
                                            </div>
                                            {violation.elementName && (
                                                <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono bg-white/60 dark:bg-slate-800/60 px-1.5 py-0.5 rounded self-start border border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="opacity-70">{violation.elementType || "node"}:</span> <span className="font-medium">{violation.elementName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded description */}
                                {isExpanded && description && (
                                    <div className="px-3 pb-3 pt-0 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30">
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-2">
                                            {description}
                                        </p>
                                        {violation.docLink && (
                                            <a
                                                href={violation.docLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`inline-flex items-center gap-1 text-[10px] ${style.color} hover:underline mt-2`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Learn more
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Powered by{" "}
                    <a
                        href="https://github.com/Flow-Scanner/lightning-flow-scanner"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        lightning-flow-scanner
                    </a>
                </p>
            </div>
        </div >
    );
};

export default FlowQuality;
