import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';

import { lintTextDocument, lintActiveTextDocument } from './lint';

export function activate(context: vscode.ExtensionContext) {
    let subscriptions = context.subscriptions;

    let diagnosticCollection = vscode.languages.createDiagnosticCollection();
    subscriptions.push(diagnosticCollection);

    async function lintAndSetDiagnostics(file: vscode.TextDocument) {
        const diagnostics = await lintTextDocument(file);
        diagnosticCollection.set(file.uri, diagnostics);
    }

    async function lintActiveDocAndSetDiagnostics() {
        const diag = await lintActiveTextDocument();
        if (diag.document) {
            diagnosticCollection.set(diag.document.uri, diag.diagnostics);
        }
    }

    subscriptions.push(workspace.onDidSaveTextDocument(lintAndSetDiagnostics));
    subscriptions.push(workspace.onDidOpenTextDocument(lintAndSetDiagnostics));
    subscriptions.push(workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri)));

    subscriptions.push(workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.scheme === 'file' && doc.uri.fsPath.endsWith('.clang-tidy')) {
            workspace.textDocuments.forEach(lintAndSetDiagnostics);
        }
    }));

    subscriptions.push(workspace.onDidChangeConfiguration(config => {
        if (config.affectsConfiguration('clang-tidy')) {
            workspace.textDocuments.forEach(lintAndSetDiagnostics);
        }
    }));

    subscriptions.push(commands.registerCommand('clang-tidy.lintFile', lintActiveDocAndSetDiagnostics));

    workspace.textDocuments.forEach(lintAndSetDiagnostics);
}

export function deactivate() { }
