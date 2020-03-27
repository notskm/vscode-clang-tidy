## [0.4.0]

- Added: `clang-tidy.buildPath` option to tell clang-tidy where the build
directory is. This is equivalent to `clang-tidy -p ...`
- Fix: Can't save while clang-tidy is running on large files

## [0.3.0]

- Added: `clang-tidy.lintOnSave` option to disable automatic linting on file save

## [0.2.2]

- Fixed: Fails with "Cannot set property 'Severity' of undefined" when using
old versions of clang-tidy

## [0.2.1]

- Bad release due to an incorrect cherry-pick. This is a learning experience!
This release had nothing more than an updated changelog. It is otherwise
equivalent to 0.2.0

## [0.2.0]

- Added: Log info in the output panel

## [0.1.0]

- Initial release

## [Unreleased]

- Fixed: Clang-Tidy will only run once. Subsequent runs produce
  `Command failed: taskkill /pid 19412 /f /t ERROR: The process "19412" not found.`
