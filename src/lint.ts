import * as vscode from "vscode";
import { runClangTidy, collectDiagnostics } from "./tidy";

export async function lintActiveTextDocument(
    loggingChannel: vscode.OutputChannel
) {
    if (vscode.window.activeTextEditor === undefined) {
        return { document: undefined, diagnostics: [] };
    }

    return {
        document: vscode.window.activeTextEditor.document,
        diagnostics: await lintTextDocument(
            vscode.window.activeTextEditor.document,
            loggingChannel,
            false
        ),
    };
}

function isBlacklisted(file: vscode.TextDocument) {
    const blacklist = vscode.workspace
        .getConfiguration("clang-tidy")
        .get("blacklist") as Array<string>;

    const relativeFilename = vscode.workspace.asRelativePath(file.fileName);

    for (let i = 0; i < blacklist.length; i++) {
        const regex = new RegExp(blacklist[i]);
        if (regex.test(relativeFilename)) {
            return true;
        }
    }
}

export async function lintTextDocument(
    file: vscode.TextDocument,
    loggingChannel: vscode.OutputChannel,
    fixErrors: boolean
) {
    if (!['cpp','c'].includes(file.languageId)) {
        return [];
    }
    if (file.uri.scheme !== "file") {
        return [];
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri);
    if (!workspaceFolder) {
        return [];
    }

    if (isBlacklisted(file)) {
        return [];
    }

    const clangTidyOut = await runClangTidy(
        [file.uri.fsPath],
        workspaceFolder.uri.fsPath,
        loggingChannel,
        fixErrors
    );
    return collectDiagnostics(clangTidyOut, file);
}
