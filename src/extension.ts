import * as vscode from "vscode";
import { FlowPanel } from "./panels/FlowPanel";

/**
 * SF Flow Visualizer Extension
 * Visualizes Salesforce Flow XML files
 */

export function activate(context: vscode.ExtensionContext) {
  console.log("SF Flow Visualizer is now active!");

  // Set context for FlowPanel to use for state persistence
  FlowPanel.setContext(context);

  const getAutoOpenSetting = () => {
    return vscode.workspace
      .getConfiguration("sf-flow-visualizer")
      .get<boolean>("autoOpenFlowViewer", true);
  };

  let autoOpenEnabled = getAutoOpenSetting();
  FlowPanel.setAutoOpenPreference(autoOpenEnabled);

  const maybeRenderFlowForEditor = (editor?: vscode.TextEditor) => {
    if (!autoOpenEnabled || !editor) {
      return;
    }

    const document = editor.document;
    if (!isFlowFile(document)) {
      return;
    }

    const xmlContent = document.getText();
    FlowPanel.render(context.extensionUri, xmlContent, document.fileName, {
      preserveFocus: true,
      sourceEditor: editor,
    });
  };

  // Register the show command (from editor)
  const showCommand = vscode.commands.registerCommand(
    "sf-flow-visualizer.show",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const xmlContent = document.getText();
        const fileName = document.fileName;
        FlowPanel.render(context.extensionUri, xmlContent, fileName);
      } else {
        vscode.window.showErrorMessage(
          "No active editor. Please open a Flow XML file."
        );
      }
    }
  );

  // Register the show command (from explorer context menu)
  const showFromExplorerCommand = vscode.commands.registerCommand(
    "sf-flow-visualizer.showFromExplorer",
    async (uri: vscode.Uri) => {
      if (uri) {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          const xmlContent = document.getText();
          FlowPanel.render(context.extensionUri, xmlContent, uri.fsPath);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open flow file: ${error}`);
        }
      }
    }
  );

  context.subscriptions.push(showCommand, showFromExplorerCommand);

  if (autoOpenEnabled) {
    maybeRenderFlowForEditor(vscode.window.activeTextEditor);
  }

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    maybeRenderFlowForEditor
  );

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("sf-flow-visualizer.autoOpenFlowViewer")) {
        autoOpenEnabled = getAutoOpenSetting();
        FlowPanel.setAutoOpenPreference(autoOpenEnabled);
        if (autoOpenEnabled) {
          maybeRenderFlowForEditor(vscode.window.activeTextEditor);
        }
      }
    }
  );

  context.subscriptions.push(editorChangeDisposable, configChangeDisposable);
}

export function deactivate() {
  // Cleanup if needed
}

function isFlowFile(document: vscode.TextDocument): boolean {
  return document.fileName.endsWith(".flow-meta.xml");
}
