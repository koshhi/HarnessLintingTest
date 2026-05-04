import * as vscode from "vscode";

import { loadLintConfig } from "../../src/config.ts";
import { lintMarkdown, type LintIssue } from "../../src/lintMarkdown.ts";

const DIAGNOSTIC_COLLECTION_NAME = "markdown-lint";
const MARKDOWN_LANGUAGE_ID = "markdown";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );

  context.subscriptions.push(diagnostics);

  const refreshCommand = vscode.commands.registerCommand(
    "markdownLint.refreshDiagnostics",
    async () => {
      await refreshAllMarkdownDiagnostics(diagnostics);
    },
  );

  const onOpen = vscode.workspace.onDidOpenTextDocument(async (document) => {
    await validateDocument(document, diagnostics);
  });

  const onChange = vscode.workspace.onDidChangeTextDocument(async (event) => {
    await validateDocument(event.document, diagnostics);
  });

  const onSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
    await validateDocument(document, diagnostics);
  });

  const onClose = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnostics.delete(document.uri);
  });

  const onFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
    await refreshAllMarkdownDiagnostics(diagnostics);
  });

  context.subscriptions.push(refreshCommand, onOpen, onChange, onSave, onClose, onFoldersChanged);

  void refreshAllMarkdownDiagnostics(diagnostics);
}

export function deactivate(): void {}

async function refreshAllMarkdownDiagnostics(
  diagnostics: vscode.DiagnosticCollection,
): Promise<void> {
  const documents = vscode.workspace.textDocuments.filter(isMarkdownDocument);
  await Promise.all(documents.map((document) => validateDocument(document, diagnostics)));
}

async function validateDocument(
  document: vscode.TextDocument,
  diagnostics: vscode.DiagnosticCollection,
): Promise<void> {
  if (!isMarkdownDocument(document)) {
    return;
  }

  try {
    const config = await loadLintConfigForDocument(document);
    const result = lintMarkdown(document.getText(), config);
    diagnostics.set(
      document.uri,
      result.issues.map((issue) => toDiagnostic(document, issue)),
    );
  } catch (error) {
    diagnostics.set(document.uri, [createConfigErrorDiagnostic(document, error)]);
  }
}

async function loadLintConfigForDocument(
  document: vscode.TextDocument,
): Promise<Awaited<ReturnType<typeof loadLintConfig>>> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    return {};
  }

  return loadLintConfig({
    cwd: workspaceFolder.uri.fsPath,
  });
}

function toDiagnostic(document: vscode.TextDocument, issue: LintIssue): vscode.Diagnostic {
  const range = createDiagnosticRange(document, issue);
  const diagnostic = new vscode.Diagnostic(
    range,
    issue.message,
    vscode.DiagnosticSeverity.Error,
  );

  diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
  diagnostic.code = issue.ruleId;

  return diagnostic;
}

function createDiagnosticRange(
  document: vscode.TextDocument,
  issue: LintIssue,
): vscode.Range {
  const lineIndex = Math.max(issue.line - 1, 0);
  const line = document.lineAt(Math.min(lineIndex, document.lineCount - 1));
  const columnIndex = Math.max(issue.column - 1, 0);

  if (issue.ruleId === "no-trailing-spaces") {
    const match = line.text.match(/[ \t]+$/);

    if (match) {
      const startCharacter = line.text.length - match[0].length;
      return new vscode.Range(line.lineNumber, startCharacter, line.lineNumber, line.text.length);
    }
  }

  if (issue.ruleId === "metadata-required-non-empty") {
    return new vscode.Range(line.lineNumber, 0, line.lineNumber, line.text.length);
  }

  const clampedCharacter = Math.min(columnIndex, line.text.length);
  return new vscode.Range(line.lineNumber, clampedCharacter, line.lineNumber, clampedCharacter);
}

function createConfigErrorDiagnostic(
  document: vscode.TextDocument,
  error: unknown,
): vscode.Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 0),
    `Failed to load markdown lint config: ${message}`,
    vscode.DiagnosticSeverity.Error,
  );

  diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
  diagnostic.code = "config-load-error";

  return diagnostic;
}

function isMarkdownDocument(document: vscode.TextDocument): boolean {
  return document.languageId === MARKDOWN_LANGUAGE_ID;
}
