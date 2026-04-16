/**
 * extension.ts
 * Entry point only — Holy Quest AI VS Code Extension.
 * Activation, deactivation, and command registration.
 */

import * as vscode from 'vscode';
import { HolyQuestAIViewProvider } from './webview/panel';

export function activate(context: vscode.ExtensionContext): void {
  // Register the main panel provider
  const provider = new HolyQuestAIViewProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HolyQuestAIViewProvider.viewType,
      provider
    )
  );

  // Register the set API key command using SecretStorage
  context.subscriptions.push(
    vscode.commands.registerCommand('holyQuestAI.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Anthropic API Key',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'sk-ant-...',
      });
      if (key && key.trim().length > 0) {
        await context.secrets.store('holyQuestAI.apiKey', key.trim());
        vscode.window.showInformationMessage(
          'Holy Quest AI: API key saved securely.'
        );
      }
    })
  );

  // Register clear API key command
  context.subscriptions.push(
    vscode.commands.registerCommand('holyQuestAI.clearApiKey', async () => {
      await context.secrets.delete('holyQuestAI.apiKey');
      vscode.window.showInformationMessage(
        'Holy Quest AI: API key cleared.'
      );
    })
  );
}

export function deactivate(): void {
  // Cleanup handled by VS Code subscription disposal
}
