import * as vscode from "vscode";
import { FlowPanel } from "./panels/FlowPanel";

/**
 * SF Flow Visualizer Extension
 * Visualizes Salesforce Flow XML files
 */

export function activate(context: vscode.ExtensionContext) {
  console.log("SF Flow Visualizer is now active!");

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
}

export function deactivate() {
  // Cleanup if needed
}
