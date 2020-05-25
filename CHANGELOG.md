# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

-   Diagnostics sometimes aren't being reported even though clang-tidy finds problems.

## [0.5.0] - 2020-05-21

### Added

-   `clang-tidy.fixOnSave` option to apply clang-tidy fixes on save

-   `clang-tidy.blacklist` option to blacklist files from being linted

### Changed

-   Files detected as C can now be linted

### Fixed

-   `clang-tidy.buildPath` fails to work because of double quotes

-   Errors from included file shown as part of parsed file

## [0.4.1] - 2020-03-26

### Fixed

-   Clang-Tidy will only run once. Subsequent runs produce
    `Command failed: taskkill /pid 19412 /f /t ERROR: The process "19412" not found.`

## [0.4.0] - 2020-03-26

### Added

-   `clang-tidy.buildPath` option to tell clang-tidy where the build
    directory is. This is equivalent to `clang-tidy -p ...`

### Fixed

-   Can't save while clang-tidy is running on large files

## [0.3.0] - 2020-01-04

### Added

-   `clang-tidy.lintOnSave` option to disable automatic linting on file save

## [0.2.2] - 2019-08-28

### Fixed

-   Fails with "Cannot set property 'Severity' of undefined" when using
    old versions of clang-tidy

## [0.2.1] - 2019-08-28

### Added

-   Bad release due to an incorrect cherry-pick. This is a learning experience!
    This release had nothing more than an updated changelog. It is otherwise
    equivalent to 0.2.0

## [0.2.0] - 2019-08-26

### Added

-   Log info in the output panel

## [0.1.0] - 2019-08-22

### Added

-   Initial release

[unreleased]: https://github.com/notskm/vscode-clang-tidy/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.4.1
[0.4.0]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.4.0
[0.3.0]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.3.0
[0.2.2]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.2.2
[0.2.1]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.2.1
[0.2.0]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.2.0
[0.1.0]: https://github.com/notskm/vscode-clang-tidy/releases/tag/v0.1.0
