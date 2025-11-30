/**
 * VS Code API Singleton
 *
 * Provides a shared instance of the VS Code API for webview communication.
 * acquireVsCodeApi() can only be called once per webview, so we cache it here.
 */

export interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): Record<string, unknown> | undefined;
  setState(state: Record<string, unknown>): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

// Singleton instance - acquireVsCodeApi can only be called once
let vscodeApi: VSCodeApi | null = null;

/**
 * Get the VS Code API instance.
 * Returns null if not running in a VS Code webview.
 */
export function getVSCodeApi(): VSCodeApi | null {
  if (vscodeApi) {
    return vscodeApi;
  }

  if (typeof acquireVsCodeApi !== "undefined") {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch (e) {
      console.warn("Failed to acquire VS Code API:", e);
      return null;
    }
  }

  return vscodeApi;
}

/**
 * Check if running in a VS Code webview environment
 */
export function isVSCodeEnvironment(): boolean {
  return getVSCodeApi() !== null;
}

export default getVSCodeApi;
