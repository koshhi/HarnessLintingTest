#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";

import { loadLintConfig } from "./config.ts";
import { lintMarkdown, type LintIssue } from "./lintMarkdown.ts";

type CliFormat = "stylish" | "json";

type ParsedArguments = {
  configPath?: string;
  format: CliFormat;
  paths: string[];
};

type FileLintResult = {
  filePath: string;
  ok: boolean;
  issues: LintIssue[];
};

type JsonReport = {
  ok: boolean;
  checkedFileCount: number;
  issueCount: number;
  files: FileLintResult[];
};

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArguments(args);

  if ("exitCode" in parsed) {
    const stream = parsed.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(getUsage());
    return parsed.exitCode;
  }

  let config;

  try {
    config = await loadLintConfig({
      cwd: process.cwd(),
      configPath: parsed.configPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 2;
  }

  let filePaths: string[];

  try {
    filePaths = await resolveMarkdownPaths(parsed.paths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 2;
  }

  if (filePaths.length === 0) {
    process.stderr.write("No Markdown files were found in the provided paths.\n");
    return 2;
  }

  const fileResults: FileLintResult[] = [];

  for (const filePath of filePaths) {
    let text: string;

    try {
      text = await readFile(filePath, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to read "${filePath}": ${message}\n`);
      return 2;
    }

    const result = lintMarkdown(text, {
      config,
      filePath,
    });

    fileResults.push({
      filePath,
      ok: result.ok,
      issues: result.issues,
    });
  }

  const issueCount = fileResults.reduce((total, file) => total + file.issues.length, 0);

  if (parsed.format === "json") {
    process.stdout.write(
      `${JSON.stringify(createJsonReport(fileResults, issueCount), null, 2)}\n`,
    );
    return issueCount === 0 ? 0 : 1;
  }

  for (const fileResult of fileResults) {
    if (fileResult.ok) {
      process.stdout.write(`${fileResult.filePath}: OK\n`);
      continue;
    }

    for (const issue of fileResult.issues) {
      process.stdout.write(formatIssue(fileResult.filePath, issue));
    }
  }

  process.stdout.write(
    `Checked ${fileResults.length} file(s), found ${issueCount} issue(s).\n`,
  );

  return issueCount === 0 ? 0 : 1;
}

function parseArguments(args: string[]): ParsedArguments | { exitCode: 0 | 2 } {
  let configPath: string | undefined;
  let format: CliFormat = "stylish";
  const paths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      return { exitCode: 0 };
    }

    if (argument === "--config") {
      const value = args[index + 1];

      if (value) {
        configPath = value;
        index += 1;
        continue;
      }

      process.stderr.write('Expected "--config" to be followed by a file path.\n');
      return { exitCode: 2 };
    }

    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);

      if (value) {
        configPath = value;
        continue;
      }

      process.stderr.write('Expected "--config" to include a file path.\n');
      return { exitCode: 2 };
    }

    if (argument === "--format") {
      const value = args[index + 1];

      if (value === "stylish" || value === "json") {
        format = value;
        index += 1;
        continue;
      }

      process.stderr.write('Expected "--format" to be followed by "stylish" or "json".\n');
      return { exitCode: 2 };
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);

      if (value === "stylish" || value === "json") {
        format = value;
        continue;
      }

      process.stderr.write('Expected "--format" to be "stylish" or "json".\n');
      return { exitCode: 2 };
    }

    paths.push(argument);
  }

  if (paths.length === 0) {
    return { exitCode: 2 };
  }

  return { configPath, format, paths };
}

async function resolveMarkdownPaths(inputPaths: string[]): Promise<string[]> {
  const collectedPaths = new Set<string>();
  const orderedPaths: string[] = [];

  for (const inputPath of inputPaths) {
    await collectMarkdownPaths(inputPath, collectedPaths, orderedPaths);
  }

  return orderedPaths;
}

async function collectMarkdownPaths(
  inputPath: string,
  collectedPaths: Set<string>,
  orderedPaths: string[],
): Promise<void> {
  let pathStat;

  try {
    pathStat = await stat(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to inspect "${inputPath}": ${message}`);
  }

  if (pathStat.isDirectory()) {
    const entries = await readdir(inputPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      await collectMarkdownPaths(`${inputPath}/${entry.name}`, collectedPaths, orderedPaths);
    }

    return;
  }

  if (pathStat.isFile() && inputPath.toLowerCase().endsWith(".md")) {
    if (!collectedPaths.has(inputPath)) {
      collectedPaths.add(inputPath);
      orderedPaths.push(inputPath);
    }
  }
}

function createJsonReport(fileResults: FileLintResult[], issueCount: number): JsonReport {
  return {
    ok: issueCount === 0,
    checkedFileCount: fileResults.length,
    issueCount,
    files: fileResults,
  };
}

function formatIssue(filePath: string, issue: LintIssue): string {
  return `${filePath}:${issue.line}:${issue.column} ${issue.severity} ${issue.ruleId} ${issue.message}\n`;
}

function getUsage(): string {
  return "Usage: markdown-lint [--config <file>] [--format stylish|json] <path...>\n";
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === new URL(`file://${process.argv[1]}`).href
  : false;

if (isEntrypoint) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
