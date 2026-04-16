import * as vscode from 'vscode';
import { HolyQuestAIViewProvider } from './webview/panel';

export function activate(context: vscode.ExtensionContext) {
    const provider = new HolyQuestAIViewProvider(context.extensionUri, context);
    provider.initialize(context).catch(err => {
        console.error('Holy Quest AI initialization error:', err);
    });
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HolyQuestAIViewProvider.viewType,
            provider
        )
    );
}

export function deactivate() {}
