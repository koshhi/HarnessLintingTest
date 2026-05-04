import { resolveLintConfig, type LintConfig } from "./config.ts";

export type LintIssue = {
  ruleId: string;
  message: string;
  severity: "error";
  line: number;
  column: number;
};

export type LintResult = {
  ok: boolean;
  issues: LintIssue[];
};

type FrontMatter = {
  fields: Record<string, string>;
  lineNumbers: Record<string, number>;
};

export function lintMarkdown(text: string, config?: LintConfig): LintResult {
  const issues: LintIssue[] = [];
  const lines = text.split("\n");
  const resolvedConfig = resolveLintConfig(config);

  if (resolvedConfig.rules["metadata-required-non-empty"].enabled) {
    validateRequiredMetadata(
      lines,
      issues,
      resolvedConfig.rules["metadata-required-non-empty"].field,
    );
  }

  if (resolvedConfig.rules["no-trailing-spaces"].enabled) {
    validateTrailingSpaces(lines, issues);
  }

  if (resolvedConfig.rules["no-multiple-blank-lines"].enabled) {
    validateMultipleBlankLines(lines, issues);
  }

  issues.sort(compareIssues);

  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateRequiredMetadata(
  lines: string[],
  issues: LintIssue[],
  requiredField: string,
): void {
  const frontMatter = parseFrontMatter(lines);

  if (!frontMatter) {
    issues.push({
      ruleId: "metadata-required-non-empty",
      message: "Expected YAML front matter at the start of the document.",
      severity: "error",
      line: 1,
      column: 1,
    });
    return;
  }

  const value = frontMatter.fields[requiredField];

  if (value === undefined) {
    issues.push({
      ruleId: "metadata-required-non-empty",
      message: `Required metadata field "${requiredField}" is missing.`,
      severity: "error",
      line: 1,
      column: 1,
    });
    return;
  }

  if (value.trim() === "") {
    issues.push({
      ruleId: "metadata-required-non-empty",
      message: `Required metadata field "${requiredField}" cannot be empty.`,
      severity: "error",
      line: frontMatter.lineNumbers[requiredField] ?? 1,
      column: 1,
    });
  }
}

function parseFrontMatter(lines: string[]): FrontMatter | null {
  if (lines[0] !== "---") {
    return null;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");

  if (closingIndex === -1) {
    return null;
  }

  const fields: Record<string, string> = {};
  const lineNumbers: Record<string, number> = {};

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    fields[key] = value;
    lineNumbers[key] = index + 1;
  }

  return { fields, lineNumbers };
}

function validateTrailingSpaces(lines: string[], issues: LintIssue[]): void {
  for (const [index, line] of lines.entries()) {
    const match = line.match(/[ \t]+$/);

    if (!match) {
      continue;
    }

    issues.push({
      ruleId: "no-trailing-spaces",
      message: "Trailing spaces are not allowed.",
      severity: "error",
      line: index + 1,
      column: line.length - match[0].length + 1,
    });
  }
}

function validateMultipleBlankLines(lines: string[], issues: LintIssue[]): void {
  let previousLineWasBlank = false;

  for (const [index, line] of lines.entries()) {
    const currentLineIsBlank = line.trim() === "";

    if (currentLineIsBlank && previousLineWasBlank) {
      issues.push({
        ruleId: "no-multiple-blank-lines",
        message: "Multiple consecutive blank lines are not allowed.",
        severity: "error",
        line: index + 1,
        column: 1,
      });
    }

    previousLineWasBlank = currentLineIsBlank;
  }
}

function compareIssues(left: LintIssue, right: LintIssue): number {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  if (left.column !== right.column) {
    return left.column - right.column;
  }

  return left.ruleId.localeCompare(right.ruleId);
}
