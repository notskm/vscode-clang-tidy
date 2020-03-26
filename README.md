# Clang-Tidy for VSCode

[![Build Status](https://img.shields.io/github/workflow/status/notskm/vscode-clang-tidy/CI)](https://github.com/notskm/vscode-clang-tidy/actions?query=workflow%3ACI)
[![ko-fi](https://img.shields.io/badge/-Support%20me%20on%20Ko--fi-red?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/notskm)

This extension integrates [clang-tidy](https://clang.llvm.org/extra/clang-tidy/) into VS Code.

[Clang-Tidy documentation can be found here.](https://clang.llvm.org/extra/clang-tidy/)

## Features

Runs clang-tidy and displays its diagnostics in VS Code.

Note: Diagnostics take longer to appear than in the example gif.

![diagnostics example animation](images/diagnostics.gif)

## Requirements

Clang-Tidy must be installed. The extension will look for the clang-tidy executable in your `PATH` by default.

Clang-Tidy is part of LLVM, which can be [downloaded here.](https://releases.llvm.org/download.html) Alternatively, use your system's package manager.

## Extension Settings

This extension contributes the following settings:

* `clang-tidy.executable`: The path to the clang-tidy executable
* `clang-tidy.checks`: List of checks to enable or disable
* `clang-tidy.compilerArgs`: List of arguments to append to the compiler command line
* `clang-tidy.compilerArgsBefore`: List of arguments to prepend to the compiler command line
* `clang-tidy.lintOnSave`: Whether or not to lint files when they are saved

## Extension Commands

This extension contributes the following commands:

* `Clang-Tidy: Lint File`: Lints the active file

## Known Issues

[See the Github issues](https://github.com/notskm/vscode-clang-tidy/issues)
