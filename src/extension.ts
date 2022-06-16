import { type } from "os";
import * as vscode from "vscode";
import { CodeActionKind, commands, TextEdit, workspace } from "vscode";
import { ClangTidyReplacement } from "./clang-tidy-yaml";

import { lintTextDocument, lintActiveTextDocument } from "./lint";

import { killClangTidy } from "./tidy";

export function activate(context: vscode.ExtensionContext) {
    let subscriptions = context.subscriptions;

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            "cpp",
            new ClangTidyInfo(),
            {
                providedCodeActionKinds: ClangTidyInfo.providedCodeActionKinds,
            }
        )
    );

    let diagnosticCollection = vscode.languages.createDiagnosticCollection();
    subscriptions.push(diagnosticCollection);

    let loggingChannel = vscode.window.createOutputChannel("Clang-Tidy");
    subscriptions.push(loggingChannel);

    async function lintAndSetDiagnostics(
        file: vscode.TextDocument,
        fixErrors = false
    ) {
        const diagnostics = await lintTextDocument(
            file,
            loggingChannel,
            fixErrors
        );
        diagnosticCollection.set(file.uri, diagnostics);
    }

    async function lintActiveDocAndSetDiagnostics() {
        const diag = await lintActiveTextDocument(loggingChannel);
        if (diag.document) {
            diagnosticCollection.set(diag.document.uri, diag.diagnostics);
        }
    }

    subscriptions.push(
        workspace.onDidSaveTextDocument((doc) => {
            if (workspace.getConfiguration("clang-tidy").get("lintOnSave")) {
                const fixErrors = workspace
                    .getConfiguration("clang-tidy")
                    .get("fixOnSave") as boolean;
                lintAndSetDiagnostics(doc, fixErrors);
            }
        })
    );
    subscriptions.push(
        workspace.onDidOpenTextDocument((doc) => {
            if (workspace.getConfiguration("clang-tidy").get("lintOnOpen")) {
                lintAndSetDiagnostics(doc);
            }
        })
    );
    subscriptions.push(
        workspace.onDidCloseTextDocument((doc) =>
            diagnosticCollection.delete(doc.uri)
        )
    );

    subscriptions.push(workspace.onWillSaveTextDocument(killClangTidy));

    subscriptions.push(
        workspace.onDidSaveTextDocument((doc) => {
            if (workspace.getConfiguration("clang-tidy").get("lintOnSave")) {
                if (
                    doc.uri.scheme === "file" &&
                    doc.uri.fsPath.endsWith(".clang-tidy")
                ) {
                    workspace.textDocuments.forEach((doc) =>
                        lintAndSetDiagnostics(doc)
                    );
                }
            }
        })
    );

    subscriptions.push(
        workspace.onDidChangeConfiguration((config) => {
            if (config.affectsConfiguration("clang-tidy")) {
                workspace.textDocuments.forEach((doc) =>
                    lintAndSetDiagnostics(doc)
                );
            }
        })
    );

    subscriptions.push(
        commands.registerCommand(
            "clang-tidy.lintFile",
            lintActiveDocAndSetDiagnostics
        )
    );

    workspace.textDocuments.forEach((doc) => lintAndSetDiagnostics(doc));
}

/**
 * Provides code actions corresponding to diagnostic problems.
 */
export class ClangTidyInfo implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        // for each diagnostic entry that has the matching `code`, create a code action command
        return context.diagnostics.reduce((acc, diagnostic) => {
            const action = this.createCommandCodeAction(document, diagnostic);
            if (!!action) {
                acc.push(action);
            }
            return acc;
        }, [] as vscode.CodeAction[]);
    }

    private createCommandCodeAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | null {
        if (
            diagnostic.source !== "clang-tidy" ||
            !diagnostic.code ||
            typeof diagnostic.code !== "string"
        ) {
            return null;
        }
        const [text, offset, len] = JSON.parse(diagnostic.code) as [
            string,
            number,
            number
        ];
        const changes = new vscode.WorkspaceEdit();
        changes.replace(
            document.uri,
            new vscode.Range(
                document.positionAt(offset),
                document.positionAt(offset + len)
            ),
            text
        );
        return {
            title: `[Clang-Tidy] Change to ${text}`,
            diagnostics: [diagnostic],
            kind: CodeActionKind.QuickFix,
            edit: changes,
        };
    }
}

export function deactivate() {}
