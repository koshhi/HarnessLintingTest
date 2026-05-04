---
title: HarnessLintingTest
---

# HarnessLintingTest

Simple Markdown linter prototype built with TypeScript.

It includes:

- A CLI that lints one or more Markdown files.
- Config loading from JSON or YAML.
- A VS Code extension that publishes workspace-wide diagnostics in the editor and `Problems` panel.
- Example Markdown content and tests.

## Requirements

- Node.js
- npm

## Install

```bash
npm install
```

## Run the CLI

Lint a single file:

```bash
npm run lint:md -- examples/sample.md
```

Lint a directory:

```bash
npm run lint:md -- examples
```

Output formats:

```bash
npm run lint:md -- --format stylish examples/sample.md
npm run lint:md -- --format json examples/sample.md
```

Use a custom config file:

```bash
npm run lint:md -- --config examples/markdown-lint.config.yaml examples/sample.md
```

## Supported Rules

- `metadata-required-non-empty`
- `no-trailing-spaces`
- `no-multiple-blank-lines`
- `require-links`

Rule documentation:

- [Linting Rules Overview](./docs/rules-documentation/linting-rules-overview.md)

## Config Files

The CLI looks for these files in the working directory:

- `markdown-lint.config.json`
- `markdown-lint.config.yaml`
- `markdown-lint.config.yml`

Example config:

```yaml
rules:
  metadata-required-non-empty:
    field: title
  no-trailing-spaces:
    enabled: true
  no-multiple-blank-lines:
    enabled: true
  require-links:
    enabled: true
overrides:
  - files: ["README.md"]
    rules:
      require-links:
        enabled: false
```

`overrides` lets you change rules by file name or path pattern. For example, the config above requires links by default but disables that rule for `README.md`.

## VS Code Extension

The extension lives in [vscode-extension](./vscode-extension) and validates Markdown files across the workspace, including files that are not already open in an editor. It refreshes diagnostics on:

- open
- change
- save
- Markdown file creation
- config file changes
- manual refresh through `Markdown Lint: Refresh Diagnostics`

To run it locally:

1. Open `vscode-extension/` in VS Code.
2. Run `npm install`.
3. Press `F5`.
4. In the Extension Development Host, open this project.

## Tests

```bash
npm test
```

## Repository Notes

- Git has been initialized locally for this project.
- `.gitignore` excludes dependencies and build artifacts.
