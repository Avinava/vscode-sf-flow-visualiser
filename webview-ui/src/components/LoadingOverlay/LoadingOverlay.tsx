import React from "react";
import { Workflow } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = "Preparing your flow...",
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col items-center p-6 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-md">
        {/* Logo and Spinner Container */}
        <div className="relative mb-4">
          {/* Background ring */}
          <div className="w-12 h-12 rounded-full border-[3px] border-slate-200 dark:border-slate-700" />
          {/* Spinning ring */}
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-[3px] border-blue-500 dark:border-blue-400 border-t-transparent animate-spin" />
          
          {/* Inner Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-sm border border-slate-100 dark:border-slate-700">
              <Workflow 
                className="w-4 h-4 text-blue-600 dark:text-blue-400" 
                strokeWidth={2.5}
              />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
            {message}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Visualizing Logic
          </p>
        </div>
      </div>
    </div>
  );
};
