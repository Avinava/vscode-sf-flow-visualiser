import * as vscode from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as path from "path";

/**
 * FlowPanel class manages the webview panel for flow visualization
 */
export class FlowPanel {
  public static currentPanel: FlowPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _webviewReady = false;

  private static _context: vscode.ExtensionContext | undefined;
  private static _latestAutoOpenPreference: boolean | undefined;

  public static setContext(context: vscode.ExtensionContext) {
    FlowPanel._context = context;
  }

  public static setAutoOpenPreference(enabled: boolean) {
    FlowPanel._latestAutoOpenPreference = enabled;
    if (FlowPanel.currentPanel) {
      FlowPanel.currentPanel._postAutoOpenPreference(enabled);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    xmlContent: string,
    fileName: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri
    );

    // Send the XML content to the webview after it's ready
    setTimeout(() => {
      this._panel.webview.postMessage({
        command: "loadXml",
        payload: xmlContent,
        fileName: path.basename(fileName),
      });
    }, 500);

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
          case "info":
            vscode.window.showInformationMessage(message.text);
            return;
          case "ready":
            this._webviewReady = true;
            // Webview is ready, send the XML content
            this._panel.webview.postMessage({
              command: "loadXml",
              payload: xmlContent,
              fileName: path.basename(fileName),
            });
            // Also send persisted state
            if (FlowPanel._context) {
              const themeMode =
                FlowPanel._context.globalState.get<string>("themeMode");
              const animateFlow =
                FlowPanel._context.globalState.get<boolean>("animateFlow");
              if (themeMode !== undefined || animateFlow !== undefined) {
                this._panel.webview.postMessage({
                  command: "restoreState",
                  payload: { themeMode, animateFlow },
                });
              }
            }
            if (FlowPanel._latestAutoOpenPreference !== undefined) {
              this._postAutoOpenPreference(FlowPanel._latestAutoOpenPreference);
            }
            return;
          case "saveState":
            // Persist state to globalState
            if (FlowPanel._context && message.payload) {
              const { key, value } = message.payload;
              FlowPanel._context.globalState.update(key, value);
            }
            return;
          case "setAutoOpenPreference":
            if (
              message.payload &&
              typeof message.payload === "object" &&
              "enabled" in message.payload
            ) {
              const enabled = Boolean(
                (message.payload as { enabled: boolean }).enabled
              );
              FlowPanel.updateAutoOpenSetting(enabled);
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Render the webview panel
   */
  public static render(
    extensionUri: vscode.Uri,
    xmlContent: string,
    fileName: string,
    options: FlowPanelRenderOptions = {}
  ) {
    const flowName = path.basename(fileName).replace(".flow-meta.xml", "");

    if (FlowPanel.currentPanel) {
      // If panel exists, update it with new content
      FlowPanel.currentPanel._panel.reveal(
        vscode.ViewColumn.Beside,
        options.preserveFocus ?? false
      );
      // Update panel title to reflect the new flow
      FlowPanel.currentPanel._panel.title = `Flow: ${flowName}`;
      FlowPanel.currentPanel._panel.webview.postMessage({
        command: "loadXml",
        payload: xmlContent,
        fileName: path.basename(fileName),
      });
    } else {
      // Create a new panel
      const panel = vscode.window.createWebviewPanel(
        "sf-flow-visualizer",
        `Flow: ${flowName}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, "webview-ui", "build"),
            vscode.Uri.joinPath(extensionUri, "webview-ui", "build", "assets"),
          ],
        }
      );

      panel.iconPath = {
        light: vscode.Uri.joinPath(extensionUri, "assets", "icon-light.svg"),
        dark: vscode.Uri.joinPath(extensionUri, "assets", "icon-dark.svg"),
      };

      FlowPanel.currentPanel = new FlowPanel(
        panel,
        extensionUri,
        xmlContent,
        fileName
      );

      if (options.preserveFocus && options.sourceEditor) {
        setTimeout(() => {
          vscode.window.showTextDocument(options.sourceEditor.document, {
            viewColumn: options.sourceEditor.viewColumn,
            preserveFocus: false,
          });
        }, 0);
      }
    }
  }

  /**
   * Dispose of the panel
   */
  public dispose() {
    FlowPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get the webview HTML content
   */
  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {
    const scriptUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.js",
    ]);
    const styleUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ]);
    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
          <link rel="stylesheet" type="text/css" href="${styleUri}">
          <title>SF Flow Visualizer</title>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private _postAutoOpenPreference(enabled: boolean) {
    if (!this._webviewReady) {
      return;
    }

    this._panel.webview.postMessage({
      command: "autoOpenPreference",
      payload: { enabled },
    });
  }

  private static updateAutoOpenSetting(enabled: boolean) {
    const config = vscode.workspace.getConfiguration("sf-flow-visualizer");
    const target =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

    config.update("autoOpenFlowViewer", enabled, target).catch((error) => {
      vscode.window.showErrorMessage(
        `Unable to update Flow Viewer auto-open preference: ${error}`
      );
      const currentValue = config.get<boolean>("autoOpenFlowViewer", true);
      FlowPanel.setAutoOpenPreference(currentValue);
    });
  }
}

interface FlowPanelRenderOptions {
  preserveFocus?: boolean;
  sourceEditor?: vscode.TextEditor;
}
