import * as vscode from "vscode";
import { readFile } from "node:fs/promises";

import { loadLintConfig } from "../../src/config.ts";
import { lintMarkdown, type LintIssue } from "../../src/lintMarkdown.ts";

const DIAGNOSTIC_COLLECTION_NAME = "markdown-lint";
const MARKDOWN_LANGUAGE_ID = "markdown";
const MARKDOWN_FILE_GLOB = "**/*.md";
const CONFIG_FILE_GLOB = "**/markdown-lint.config.{json,yaml,yml}";

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

  const markdownWatcher = vscode.workspace.createFileSystemWatcher(MARKDOWN_FILE_GLOB);
  const configWatcher = vscode.workspace.createFileSystemWatcher(CONFIG_FILE_GLOB);

  const onMarkdownCreated = markdownWatcher.onDidCreate(async (uri) => {
    await validateUri(uri, diagnostics);
  });

  const onMarkdownDeleted = markdownWatcher.onDidDelete((uri) => {
    diagnostics.delete(uri);
  });

  const onConfigChanged = configWatcher.onDidChange(async () => {
    await refreshAllMarkdownDiagnostics(diagnostics);
  });

  const onConfigCreated = configWatcher.onDidCreate(async () => {
    await refreshAllMarkdownDiagnostics(diagnostics);
  });

  const onConfigDeleted = configWatcher.onDidDelete(async () => {
    await refreshAllMarkdownDiagnostics(diagnostics);
  });

  context.subscriptions.push(
    refreshCommand,
    onOpen,
    onChange,
    onSave,
    onClose,
    onFoldersChanged,
    markdownWatcher,
    configWatcher,
    onMarkdownCreated,
    onMarkdownDeleted,
    onConfigChanged,
    onConfigCreated,
    onConfigDeleted,
  );

  void refreshAllMarkdownDiagnostics(diagnostics);
}

export function deactivate(): void {}

async function refreshAllMarkdownDiagnostics(
  diagnostics: vscode.DiagnosticCollection,
): Promise<void> {
  const markdownUris = await vscode.workspace.findFiles(
    MARKDOWN_FILE_GLOB,
    "**/{node_modules,.git,vscode-extension/node_modules}/**",
  );

  await Promise.all(markdownUris.map((uri) => validateUri(uri, diagnostics)));
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
    const result = lintMarkdown(document.getText(), {
      config,
      filePath: document.uri.fsPath,
    });
    diagnostics.set(
      document.uri,
      result.issues.map((issue) => toDiagnostic(document, issue)),
    );
  } catch (error) {
    diagnostics.set(document.uri, [createConfigErrorDiagnostic(document, error)]);
  }
}

async function validateUri(
  uri: vscode.Uri,
  diagnostics: vscode.DiagnosticCollection,
): Promise<void> {
  const openDocument = vscode.workspace.textDocuments.find(
    (document) => document.uri.toString() === uri.toString(),
  );

  if (openDocument) {
    await validateDocument(openDocument, diagnostics);
    return;
  }

  try {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const config = workspaceFolder
      ? await loadLintConfig({ cwd: workspaceFolder.uri.fsPath })
      : {};
    const text = await readFile(uri.fsPath, "utf8");
    const result = lintMarkdown(text, {
      config,
      filePath: uri.fsPath,
    });

    diagnostics.set(uri, result.issues.map((issue) => toDiagnosticFromText(text, issue)));
  } catch (error) {
    try {
      const fallbackDocument = await vscode.workspace.openTextDocument(uri);
      diagnostics.set(uri, [createConfigErrorDiagnostic(fallbackDocument, error)]);
    } catch {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `Failed to validate document: ${error instanceof Error ? error.message : String(error)}`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
      diagnostic.code = "document-read-error";
      diagnostics.set(uri, [diagnostic]);
    }
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
  const range = createDiagnosticRange(document.getText(), issue);
  const diagnostic = new vscode.Diagnostic(
    range,
    issue.message,
    vscode.DiagnosticSeverity.Error,
  );

  diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
  diagnostic.code = issue.ruleId;

  return diagnostic;
}

function toDiagnosticFromText(text: string, issue: LintIssue): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    createDiagnosticRange(text, issue),
    issue.message,
    vscode.DiagnosticSeverity.Error,
  );

  diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
  diagnostic.code = issue.ruleId;

  return diagnostic;
}

function createDiagnosticRange(text: string, issue: LintIssue): vscode.Range {
  const lines = text.split("\n");
  const lineIndex = Math.max(issue.line - 1, 0);
  const safeLineIndex = Math.min(lineIndex, Math.max(lines.length - 1, 0));
  const line = lines[safeLineIndex] ?? "";
  const columnIndex = Math.max(issue.column - 1, 0);

  if (issue.ruleId === "no-trailing-spaces") {
    const match = line.match(/[ \t]+$/);

    if (match) {
      const startCharacter = line.length - match[0].length;
      return new vscode.Range(safeLineIndex, startCharacter, safeLineIndex, line.length);
    }
  }

  if (issue.ruleId === "metadata-required-non-empty") {
    return new vscode.Range(safeLineIndex, 0, safeLineIndex, line.length);
  }

  const clampedCharacter = Math.min(columnIndex, line.length);
  return new vscode.Range(safeLineIndex, clampedCharacter, safeLineIndex, clampedCharacter);
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
