import * as vscode from 'vscode';
import { runClangTidy, collectDiagnostics } from './tidy';

export async function lintActiveTextDocument(loggingChannel: vscode.OutputChannel) {
    if (vscode.window.activeTextEditor === undefined) {
        return { document: undefined, diagnostics: [] };
    }

    return {
        document: vscode.window.activeTextEditor.document,
        diagnostics: await lintTextDocument(vscode.window.activeTextEditor.document, loggingChannel, false)
    };
}

export async function lintTextDocument(file: vscode.TextDocument, loggingChannel: vscode.OutputChannel, fixErrors: boolean) {
    if (!['cpp'].includes(file.languageId)) {
        return [];
    }
    if (file.uri.scheme !== 'file') {
        return [];
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri);

    if (!workspaceFolder) {
        return [];
    }

    const clangTidyOut = await runClangTidy([file.uri.fsPath], workspaceFolder.uri.fsPath, loggingChannel, fixErrors);
    return collectDiagnostics(clangTidyOut, file);
}
