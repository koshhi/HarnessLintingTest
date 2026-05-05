# HarnessLintingTest

Simple Markdown linter prototype built with TypeScript.

It includes:

- A CLI that lints one or more Markdown files.
- Config loading from JSON or YAML.
- A VS Code extension that publishes workspace-wide diagnostics in the editor and `Problems` panel.
- Example Markdown content and tests.
- Two extension workflows: local installation for normal use and `Extension Development Host` for rule development.

## Requirements

- Node.js
- npm

## Install

```bash
npm install
```

That single command also installs the dependencies needed by the VS Code extension under `vscode-extension/`.

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
    fields:
      - title
      - description
      - author
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

`metadata-required-non-empty` supports either a single `field` or multiple `fields`.

## VS Code Extension

The extension lives in [vscode-extension](./vscode-extension) and validates Markdown files across the workspace, including files that are not already open in an editor. It refreshes diagnostics on:

- open
- change
- save
- Markdown file creation
- config file changes
- manual refresh through `Markdown Lint: Refresh Diagnostics`

### Normal Use: Install Locally In VS Code

This is the recommended flow if you want to use the extension like a normal local tool.

1. Run:

```bash
npm run extension:install-local
```

2. If VS Code is already open, run `Developer: Reload Window`.
3. Open this repository in VS Code and edit any Markdown file.

If the `code` command is not available in your shell, install manually from the generated VSIX:

1. Run:

```bash
npm run extension:pack
```

2. In VS Code, run `Extensions: Install from VSIX...`
3. Pick `vscode-extension/markdown-lint-prototype.vsix`

### Development: Work On Rules Or Extension Code

This is the recommended flow if you are changing `src/lintMarkdown.ts`, `src/config.ts`, or `vscode-extension/src/extension.ts`.

1. Start the watcher from the repo root:

```bash
npm run extension:dev
```

2. In VS Code, open the repository root.
3. Go to `Run and Debug`.
4. Run `Run Markdown Lint Extension`.
5. Keep the watcher running while you edit code.
6. After code changes, use `Developer: Reload Window` inside the `Extension Development Host`.

`F5` remains a development/debug flow, not the primary user flow.

### Quick Reference

| What changed | Action needed | Reinstall VSIX |
| --- | --- | --- |
| Markdown content (`.md`) | Nothing extra; diagnostics should refresh automatically | No |
| Linter config (`markdown-lint.config.*`) | Nothing extra; diagnostics should refresh automatically | No |
| Linter or extension code (`src/*.ts`, `vscode-extension/src/*.ts`) | Recompile via watcher and run `Developer: Reload Window` | No |
| Final local validation in normal VS Code | Run `npm run extension:install-local` | Yes |

### Legacy Debug Flow

If you still want to run the extension directly from the extension folder:

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
