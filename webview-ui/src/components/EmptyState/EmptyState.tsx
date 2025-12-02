import React from "react";
import { FileSearch } from "lucide-react";

export const EmptyState: React.FC = () => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm z-0">
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <FileSearch size={40} className="text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
          No Flow Loaded
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          Open a Salesforce Flow file (.flow-meta.xml) to visualize it here.
        </p>
      </div>
    </div>
  );
};
