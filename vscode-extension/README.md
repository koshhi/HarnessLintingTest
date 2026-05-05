# Markdown Lint VS Code Extension

This extension publishes diagnostics from the local Markdown linter into the editor and the `Problems` panel.

## Recommended workflows

### Normal use

From the repository root:

```bash
npm run extension:install-local
```

If VS Code is already open, run `Developer: Reload Window`.

### Development

From the repository root:

```bash
npm run extension:dev
```

Then open the repository root in VS Code and run `Run Markdown Lint Extension` from `Run and Debug`.

Use `Developer: Reload Window` in the `Extension Development Host` after code changes.

### Legacy direct debug flow

1. Open `/Users/cesar/Projects/HarnessLintingTest/vscode-extension` in VS Code.
2. Run `npm install`.
3. Press `F5`.
4. In the Extension Development Host window, open `/Users/cesar/Projects/HarnessLintingTest`.
5. Open a `.md` file such as `examples/sample.md`.

The extension validates Markdown files on open, on change, on save, and through the command `Markdown Lint: Refresh Diagnostics`.

## Config

The extension uses the same config file names as the CLI from the workspace root:

- `markdown-lint.config.json`
- `markdown-lint.config.yaml`
- `markdown-lint.config.yml`
