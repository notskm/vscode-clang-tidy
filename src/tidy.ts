import { ChildProcess, execFile, execFileSync } from "child_process";
import { isAbsolute, join, normalize } from "path";
import * as vscode from "vscode";
import * as jsYaml from "js-yaml";
import {
    ClangTidyDiagnostic,
    ClangTidyResults,
    ClangTidyYaml,
} from "./clang-tidy-yaml";

function clangTidyArgs(files: string[], fixErrors: boolean) {
    let args: string[] = [...files, "--export-fixes=-"];

    const checks = vscode.workspace
        .getConfiguration("clang-tidy")
        .get("checks") as Array<string>;

    if (checks.length > 0) {
        args.push(`--checks=${checks.join(",")}`);
    }

    const compilerArgs = vscode.workspace
        .getConfiguration("clang-tidy")
        .get("compilerArgs") as Array<string>;

    compilerArgs.forEach((arg) => {
        args.push(`--extra-arg=${arg}`);
    });

    const compilerArgsBefore = vscode.workspace
        .getConfiguration("clang-tidy")
        .get("compilerArgsBefore") as Array<string>;

    compilerArgsBefore.forEach((arg) => {
        args.push(`--extra-arg-before=${arg}`);
    });

    const buildPath = vscode.workspace
        .getConfiguration("clang-tidy")
        .get("buildPath") as string;

    if (buildPath.length > 0) {
        args.push(`-p=${buildPath}`);
    }

    if (fixErrors) {
        args.push("--fix");
    }

    return args;
}

function clangTidyExecutable() {
    return vscode.workspace
        .getConfiguration("clang-tidy")
        .get("executable") as string;
}

class ChildProcessWithExitFlag {
    constructor(process: ChildProcess) {
        this.process = process;
        this.exited = false;

        process.on("exit", () => (this.exited = true));
    }

    process: ChildProcess;
    exited: boolean;
}

let clangTidyProcess: ChildProcessWithExitFlag | undefined = undefined;

export function killClangTidy() {
    if (
        clangTidyProcess === undefined ||
        clangTidyProcess.exited ||
        clangTidyProcess.process.killed
    ) {
        return;
    }

    // process.kill() does not work on Windows for some reason.
    // We can use the taskkill command instead.
    if (process.platform === "win32") {
        const pid = clangTidyProcess.process.pid.toString();
        execFileSync("taskkill", ["/pid", pid, "/f", "/t"]);
        clangTidyProcess.process.killed = true;
    } else {
        clangTidyProcess.process.kill();
    }
}

export function runClangTidy(
    files: string[],
    workingDirectory: string,
    loggingChannel: vscode.OutputChannel,
    fixErrors: boolean
): Thenable<string> {
    killClangTidy();

    const progressMessage = fixErrors
        ? "Linting and fixing current file (do not modify it in the meanwhile)..."
        : "Linting current file...";

    return vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification },
        (progress) => {
            progress.report({ message: progressMessage });

            return new Promise<string>((resolve) => {
                const clangTidy = clangTidyExecutable();
                const args = clangTidyArgs(files, fixErrors);

                loggingChannel.appendLine(`> ${clangTidy} ${args.join(" ")}`);
                loggingChannel.appendLine(
                    `Working Directory: ${workingDirectory}`
                );

                clangTidyProcess = new ChildProcessWithExitFlag(
                    execFile(
                        clangTidy,
                        args,
                        { cwd: workingDirectory },
                        (error, stdout, stderr) => {
                            loggingChannel.appendLine(stdout);
                            loggingChannel.appendLine(stderr);
                            resolve(stdout);
                        }
                    )
                );
            });
        }
    );
}

function tidyOutputAsObject(clangTidyOutput: string) {
    const yamlIndex = clangTidyOutput.search(/^---$/m);
    if (yamlIndex < 0) {
        return { MainSourceFile: "", Diagnostics: [] };
    }
    const rawYaml = clangTidyOutput.substr(yamlIndex);

    const tidyResults = jsYaml.safeLoad(rawYaml) as ClangTidyYaml;

    let structuredResults: ClangTidyResults = {
        MainSourceFile: tidyResults.MainSourceFile,
        Diagnostics: [],
    };

    tidyResults.Diagnostics.forEach((diag) => {
        if (diag.DiagnosticMessage) {
            structuredResults.Diagnostics.push({
                DiagnosticName: diag.DiagnosticName,
                DiagnosticMessage: {
                    Message: diag.DiagnosticMessage.Message,
                    FilePath: diag.DiagnosticMessage.FilePath,
                    FileOffset: diag.DiagnosticMessage.FileOffset,
                    Replacements: diag.DiagnosticMessage.Replacements,
                    Severity: vscode.DiagnosticSeverity.Warning,
                },
                BuildDirectory: diag.BuildDirectory
            });
        } else if (diag.Message && diag.FilePath && diag.FileOffset) {
            structuredResults.Diagnostics.push({
                DiagnosticName: diag.DiagnosticName,
                DiagnosticMessage: {
                    Message: diag.Message,
                    FilePath: diag.FilePath,
                    FileOffset: diag.FileOffset,
                    Replacements: diag.Replacements ? diag.Replacements : [],
                    Severity: vscode.DiagnosticSeverity.Warning,
                },
            });
        }
    });

    let diagnostics = structuredResults.Diagnostics;

    const severities = collectDiagnosticSeverities(clangTidyOutput);
    for (let i = 0; i < diagnostics.length || i < severities.length; i++) {
        diagnostics[i].DiagnosticMessage.Severity = severities[i];
    }

    return structuredResults;
}

function generateVScodeDiagnostics(
    document: vscode.TextDocument,
    tidyDiagnostic: ClangTidyDiagnostic
): vscode.Diagnostic[] {
    const diagnosticMessage = tidyDiagnostic.DiagnosticMessage;
    if (diagnosticMessage.Replacements.length > 0) {
        return diagnosticMessage.Replacements.map((replacement) => {
            const beginPos = document.positionAt(replacement.Offset);
            const endPos = document.positionAt(
                replacement.Offset + replacement.Length
            );

            let diagnostic = new vscode.Diagnostic(
                new vscode.Range(beginPos, endPos),
                diagnosticMessage.Message,
                diagnosticMessage.Severity
            );
            // embed information needed for quickfix in code
            diagnostic.code = JSON.stringify([
                replacement.ReplacementText,
                replacement.Offset,
                replacement.Length,
            ]);
            diagnostic.source = "clang-tidy";
            return diagnostic;
        });
    } else {
        const line = document.positionAt(diagnosticMessage.FileOffset).line;
        let diagnostic = new vscode.Diagnostic(
            new vscode.Range(line, 0, line, Number.MAX_VALUE),
            diagnosticMessage.Message,
            diagnosticMessage.Severity
        );
        diagnostic.source = "clang-tidy";
        return [diagnostic];
    }
}

function fixDiagnosticRanges(
    tidyResults: ClangTidyResults,
    document: vscode.TextDocument
) {
    const buffer = Buffer.from(document.getText());

    tidyResults.Diagnostics.forEach((diagnostic) => {
        diagnostic.DiagnosticMessage.FileOffset = buffer
            .slice(0, diagnostic.DiagnosticMessage.FileOffset)
            .toString().length;

        diagnostic.DiagnosticMessage.Replacements.forEach((replacement) => {
            replacement.Length = buffer
                .slice(
                    replacement.Offset,
                    replacement.Offset + replacement.Length
                )
                .toString().length;

            replacement.Offset = buffer
                .slice(0, replacement.Offset)
                .toString().length;
        });
    });
}

export function collectDiagnostics(
    clangTidyOutput: string,
    document: vscode.TextDocument
) {
    const tidyResults = tidyOutputAsObject(clangTidyOutput);

    fixDiagnosticRanges(tidyResults, document);

    const results = tidyResults.Diagnostics.reduce((acc, diag) => {
        const diagnosticMessage = diag.DiagnosticMessage;

        // If the provided `FilePath` is a relative path, try to to make
        // it an absolute path so that the later `asRelativePath` will
        // generate the _correct_ relative path for the equality test.
        let diagnosticFilePath = diagnosticMessage.FilePath;

        if (!isAbsolute(diagnosticFilePath) && !!diag.BuildDirectory) {
            diagnosticFilePath = normalize(join(diag.BuildDirectory, diagnosticFilePath));
        }

        // We make these paths relative before comparing them because
        // on Windows, the drive letter is lowercase for the document filename,
        // but uppercase for the diagnostic message file path. This caused the
        // comparison to fail when it shouldn't.
        if (
            vscode.workspace.asRelativePath(document.fileName) !==
            vscode.workspace.asRelativePath(diagnosticFilePath)
        ) {
            return acc; // The message isn't related to current file
        }
        generateVScodeDiagnostics(document, diag).forEach((a) => acc.push(a));
        return acc;
    }, [] as vscode.Diagnostic[]);

    return results;
}

function collectDiagnosticSeverities(clangTidyOutput: string) {
    const data = clangTidyOutput.split("\n");

    const regex: RegExp = /^.*:\d+:\d+:\s+(warning|error|info|hint):\s+.*$/;

    let severities: vscode.DiagnosticSeverity[] = [];

    data.forEach((line) => {
        const matches = regex.exec(line);
        if (matches === null) {
            return;
        }

        switch (matches[1]) {
            case "error":
                severities.push(vscode.DiagnosticSeverity.Error);
                break;
            case "warning":
                severities.push(vscode.DiagnosticSeverity.Warning);
                break;
            case "info":
                severities.push(vscode.DiagnosticSeverity.Information);
                break;
            case "hint":
                severities.push(vscode.DiagnosticSeverity.Hint);
                break;
            default:
                severities.push(vscode.DiagnosticSeverity.Warning);
                break;
        }
    });

    return severities;
}
