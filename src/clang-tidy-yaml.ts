import { DiagnosticSeverity } from "vscode";

export interface ClangTidyResults {
    MainSourceFile: string;
    Diagnostics: ClangTidyDiagnostic[];
}

export interface ClangTidyDiagnostic {
    DiagnosticName: string;
    DiagnosticMessage: {
        Message: string;
        FilePath: string;
        FileOffset: number;
        Replacements: ClangTidyReplacement[];
        Severity: DiagnosticSeverity | DiagnosticSeverity.Warning;
    };
}

export interface ClangTidyReplacement {
    FilePath: string;
    Offset: number;
    Length: number;
    ReplacementText: string;
}

export interface ClangTidyYaml {
    MainSourceFile: string;
    Diagnostics: [
        {
            DiagnosticName: string;

            // Old style diagnostic info. For older versions of clang-tidy
            Message?: string;
            FilePath?: string;
            FileOffset?: number;
            Replacements?: ClangTidyReplacement[];

            // Newer style diagnostic info. For newer versions of clang-tidy
            DiagnosticMessage?: {
                Message: string;
                FilePath: string;
                FileOffset: number;
                Replacements: ClangTidyReplacement[];
            };
        }
    ];
}
