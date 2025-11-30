/**
 * VS Code Messaging Hook
 *
 * Handles communication between the webview and VS Code extension host.
 * Manages loading flow XML files and other VS Code commands.
 */

import { useEffect, useCallback, useRef } from "react";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Singleton VS Code API instance
const vscode =
  typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

export interface VSCodeMessage {
  command: string;
  payload?: string;
  fileName?: string;
}

export interface UseVSCodeMessagingOptions {
  onLoadXml: (xml: string, fileName?: string) => void;
}

export interface UseVSCodeMessagingResult {
  postMessage: (message: unknown) => void;
  isVSCodeEnvironment: boolean;
}

/**
 * Hook for VS Code webview messaging
 *
 * @param options - Configuration options including callbacks for message handling
 * @returns Object with postMessage function and environment flag
 */
export function useVSCodeMessaging(
  options: UseVSCodeMessagingOptions
): UseVSCodeMessagingResult {
  const { onLoadXml } = options;

  // Use ref to avoid stale closure issues
  const onLoadXmlRef = useRef(onLoadXml);
  onLoadXmlRef.current = onLoadXml;

  // Message handler
  useEffect(() => {
    const handler = (event: MessageEvent<VSCodeMessage>) => {
      const { command, payload, fileName } = event.data;

      switch (command) {
        case "loadXml":
          if (payload) {
            onLoadXmlRef.current(payload, fileName);
          }
          break;
        // Add more commands as needed
        default:
          console.warn(`Unknown VS Code command: ${command}`);
      }
    };

    window.addEventListener("message", handler);

    // Signal to VS Code that webview is ready
    if (vscode) {
      vscode.postMessage({ command: "ready" });
    }

    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  // Post message to VS Code
  const postMessage = useCallback((message: unknown) => {
    if (vscode) {
      vscode.postMessage(message);
    }
  }, []);

  return {
    postMessage,
    isVSCodeEnvironment: vscode !== null,
  };
}

export default useVSCodeMessaging;
