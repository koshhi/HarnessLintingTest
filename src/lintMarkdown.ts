import { resolveLintConfigForFile, type LintConfig } from "./config.ts";
import { parse as parseYaml } from "yaml";

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

export type LintOptions = {
  config?: LintConfig;
  filePath?: string;
};

type FrontMatter = {
  fields: Record<string, unknown>;
  lineNumbers: Record<string, number>;
};

export function lintMarkdown(text: string, config?: LintConfig): LintResult;
export function lintMarkdown(text: string, options?: LintOptions): LintResult;
export function lintMarkdown(
  text: string,
  configOrOptions?: LintConfig | LintOptions,
): LintResult {
  const issues: LintIssue[] = [];
  const lines = text.split("\n");
  const { config, filePath } = normalizeLintOptions(configOrOptions);
  const resolvedConfig = resolveLintConfigForFile(config, filePath);

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

  if (resolvedConfig.rules["require-links"].enabled) {
    validateRequireLinks(lines, issues);
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

  if (isMetadataValueEmpty(value)) {
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

  const frontMatterText = lines.slice(1, closingIndex).join("\n");
  let parsedFrontMatter: unknown;

  try {
    parsedFrontMatter = parseYaml(frontMatterText);
  } catch {
    return null;
  }

  const fields = isRecord(parsedFrontMatter) ? parsedFrontMatter : {};
  const lineNumbers: Record<string, number> = {};

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    if (!(key in lineNumbers)) {
      lineNumbers[key] = index + 1;
    }
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

function validateRequireLinks(lines: string[], issues: LintIssue[]): void {
  const markdown = lines.join("\n");
  const hasMarkdownLink = /\[[^\]]+\]\([^)]+\)/.test(markdown);
  const hasAutoLink = /<https?:\/\/[^>]+>/.test(markdown);
  const hasBareUrl = /https?:\/\/\S+/.test(markdown);

  if (hasMarkdownLink || hasAutoLink || hasBareUrl) {
    return;
  }

  issues.push({
    ruleId: "require-links",
    message: "Document must contain at least one link.",
    severity: "error",
    line: 1,
    column: 1,
  });
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

function isMetadataValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLintOptions(configOrOptions?: LintConfig | LintOptions): LintOptions {
  if (!configOrOptions) {
    return {};
  }

  if ("config" in configOrOptions || "filePath" in configOrOptions) {
    return configOrOptions;
  }

  return { config: configOrOptions };
}
