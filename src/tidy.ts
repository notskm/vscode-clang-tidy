import { ChildProcess, execFile, execFileSync } from 'child_process';
import * as vscode from 'vscode';
import * as jsYaml from 'js-yaml';

function clangTidyArgs(files: string[]) {
    let args: string[] = [...files, '--export-fixes=-'];

    const checks = vscode.workspace
        .getConfiguration('clang-tidy')
        .get('checks') as Array<string>;

    if (checks.length > 0) {
        args.push(`--checks=${checks.join(',')}`);
    }

    const compilerArgs = vscode.workspace
        .getConfiguration('clang-tidy')
        .get('compilerArgs') as Array<string>;

    compilerArgs.forEach(arg => {
        args.push(`--extra-arg=${arg}`);
    });

    const compilerArgsBefore = vscode.workspace
        .getConfiguration('clang-tidy')
        .get('compilerArgsBefore') as Array<string>;

    compilerArgsBefore.forEach(arg => {
        args.push(`--extra-arg-before=${arg}`);
    });

    const buildPath = vscode.workspace
        .getConfiguration('clang-tidy')
        .get('buildPath') as string;

    if (buildPath.length > 0) {
        args.push(`-p="${buildPath}"`);
    }

    return args;
}

function clangTidyExecutable() {
    return vscode.workspace
        .getConfiguration('clang-tidy')
        .get('executable') as string;
}

class ChildProcessWithExitFlag {
    constructor(process: ChildProcess) {
        this.process = process;
        this.exited = false;

        process.on('exit', () => this.exited = false);
    }

    process: ChildProcess;
    exited: boolean;
}

let clangTidyProcess: ChildProcessWithExitFlag | undefined = undefined;

export function killClangTidy() {
    if (clangTidyProcess === undefined
        || clangTidyProcess.exited
        || clangTidyProcess.process.killed) {
        return;
    }

    // process.kill() does not work on Windows for some reason.
    // We can use the taskkill command instead.
    if (process.platform === 'win32') {
        const pid = clangTidyProcess.process.pid.toString();
        execFileSync('taskkill', ['/pid', pid, '/f', '/t']);
        clangTidyProcess.process.killed = true;
    }
    else {
        clangTidyProcess.process.kill();
    }
}

export function runClangTidy(files: string[], workingDirectory: string, loggingChannel: vscode.OutputChannel): Promise<string> {
    killClangTidy();

    return new Promise(resolve => {
        const clangTidy = clangTidyExecutable();
        const args = clangTidyArgs(files);

        loggingChannel.appendLine(`> ${clangTidy} ${args.join(' ')}`);
        loggingChannel.appendLine(`Working Directory: ${workingDirectory}`);

        clangTidyProcess = new ChildProcessWithExitFlag(
            execFile(clangTidy, args, { 'cwd': workingDirectory }, (error, stdout, stderr) => {
                loggingChannel.appendLine(stdout);
                loggingChannel.appendLine(stderr);
                resolve(stdout);
            }));
    });
}

interface ClangTidyResults {
    MainSourceFile: string;
    Diagnostics: ClangTidyDiagnostic[];
}

interface ClangTidyDiagnostic {
    DiagnosticName: string;
    DiagnosticMessage: {
        Message: string;
        FilePath: string;
        FileOffset: number;
        Replacements: ClangTidyReplacements[];
        Severity: vscode.DiagnosticSeverity | vscode.DiagnosticSeverity.Warning;
    };
}

interface ClangTidyReplacements {
    FilePath: string;
    Offset: number;
    Length: number;
    ReplacementText: string;
}

interface ClangTidyYaml {
    MainSourceFile: string;
    Diagnostics: [{
        DiagnosticName: string;

        // Old style diagnostic info. For older versions of clang-tidy
        Message?: string;
        FilePath?: string;
        FileOffset?: number;
        Replacements?: ClangTidyReplacements[];

        // Newer style diagnostic info. For newer versions of clang-tidy
        DiagnosticMessage?: {
            Message: string;
            FilePath: string;
            FileOffset: number;
            Replacements: ClangTidyReplacements[];
        };
    }];
}

function tidyOutputAsObject(clangTidyOutput: string) {
    const regex = /(^\-\-\-(.*\n)*\.\.\.$)/gm;
    const match = regex.exec(clangTidyOutput);

    if (!match) {
        return { MainSourceFile: "", Diagnostics: [] };
    }

    const tidyResults = jsYaml.safeLoad(match[0]) as ClangTidyYaml;

    let structuredResults: ClangTidyResults = {
        "MainSourceFile": tidyResults.MainSourceFile,
        "Diagnostics": []
    };

    tidyResults.Diagnostics.forEach(diag => {
        if (diag.DiagnosticMessage) {
            structuredResults.Diagnostics.push({
                "DiagnosticName": diag.DiagnosticName,
                "DiagnosticMessage": {
                    "Message": diag.DiagnosticMessage.Message,
                    "FilePath": diag.DiagnosticMessage.FilePath,
                    "FileOffset": diag.DiagnosticMessage.FileOffset,
                    "Replacements": diag.DiagnosticMessage.Replacements,
                    "Severity": vscode.DiagnosticSeverity.Warning
                }
            });
        }
        else if (diag.Message && diag.FilePath && diag.FileOffset) {
            structuredResults.Diagnostics.push({
                "DiagnosticName": diag.DiagnosticName,
                "DiagnosticMessage": {
                    "Message": diag.Message,
                    "FilePath": diag.FilePath,
                    "FileOffset": diag.FileOffset,
                    "Replacements": diag.Replacements ? diag.Replacements : [],
                    "Severity": vscode.DiagnosticSeverity.Warning
                }
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

export function collectDiagnostics(clangTidyOutput: string, document: vscode.TextDocument) {
    let results: vscode.Diagnostic[] = [];

    const tidyResults = tidyOutputAsObject(clangTidyOutput);

    tidyResults.Diagnostics.forEach(diag => {
        const diagnosticMessage = diag.DiagnosticMessage;

        if (diagnosticMessage.Replacements.length > 0) {
            diagnosticMessage.Replacements
                .forEach(replacement => {
                    const beginPos = document.positionAt(replacement.Offset);
                    const endPos = document.positionAt(replacement.Offset + replacement.Length);

                    const diagnostic = {
                        range: new vscode.Range(beginPos, endPos),
                        severity: diagnosticMessage.Severity,
                        message: diagnosticMessage.Message,
                        code: diag.DiagnosticName,
                        source: 'clang-tidy'
                    };

                    results.push(diagnostic);
                });
        }
        else {
            const line = document.positionAt(diagnosticMessage.FileOffset).line;
            results.push({
                range: new vscode.Range(line, 0, line, Number.MAX_VALUE),
                severity: diagnosticMessage.Severity,
                message: diagnosticMessage.Message,
                code: diag.DiagnosticName,
                source: 'clang-tidy'
            });
        }
    });

    return results;
}

function collectDiagnosticSeverities(clangTidyOutput: string) {
    const data = clangTidyOutput.split('\n');

    const regex: RegExp = /^.*:\d+:\d+:\s+(warning|error|info|hint):\s+.*$/;

    let severities: vscode.DiagnosticSeverity[] = [];

    data.forEach(line => {
        const matches = regex.exec(line);
        if (matches === null) {
            return;
        }

        switch (matches[1]) {
            case 'error':
                severities.push(vscode.DiagnosticSeverity.Error);
                break;
            case 'warning':
                severities.push(vscode.DiagnosticSeverity.Warning);
                break;
            case 'info':
                severities.push(vscode.DiagnosticSeverity.Information);
                break;
            case 'hint':
                severities.push(vscode.DiagnosticSeverity.Hint);
                break;
            default:
                severities.push(vscode.DiagnosticSeverity.Warning);
                break;
        }
    });

    return severities;
}
