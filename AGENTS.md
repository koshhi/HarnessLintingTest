# AGENTS.md

## Working Rules

- When creating or editing Markdown files in this repository, run the Markdown linter before sending the final response.
- If only a small number of Markdown files were touched, lint the specific files instead of the whole project.
- Use `npm run lint:md -- <path...>` from the repository root.
- Do not consider Markdown work complete while lint errors remain, unless the user explicitly asks to leave them unresolved.

## VS Code Diagnostics

- This repository includes a VS Code extension under `vscode-extension/` that publishes Markdown lint diagnostics to the editor and the `Problems` panel.
- Those editor diagnostics are useful for the human editing flow, but agent verification should still rely on the CLI because the agent does not have direct access to the VS Code diagnostics panel in this environment.
