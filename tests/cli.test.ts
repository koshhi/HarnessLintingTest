import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const createdDirectories: string[] = [];

describe("markdown CLI", () => {
  afterEach(() => {
    for (const directory of createdDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns success for a valid markdown file", () => {
    const filePath = createMarkdownFile(`---
title: Hello
---

Body`);

    const result = runCli([filePath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${filePath}: OK\nChecked 1 file(s), found 0 issue(s).\n`);
    expect(result.stderr).toBe("");
  });

  it("returns issues for an invalid markdown file", () => {
    const filePath = createMarkdownFile(`---
title:
---


Body with spaces   `);

    const result = runCli([filePath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      `${filePath}:2:1 error metadata-required-non-empty Required metadata field "title" cannot be empty.\n` +
        `${filePath}:5:1 error no-multiple-blank-lines Multiple consecutive blank lines are not allowed.\n` +
        `${filePath}:6:17 error no-trailing-spaces Trailing spaces are not allowed.\n` +
        "Checked 1 file(s), found 3 issue(s).\n",
    );
    expect(result.stderr).toBe("");
  });

  it("shows usage when no file path is provided", () => {
    const result = spawnSync(process.execPath, ["src/cli.ts"], {
      cwd: projectRoot(),
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Usage: markdown-lint [--config <file>] [--format stylish|json] <path...>\n",
    );
  });

  it("prints JSON output when requested", () => {
    const filePath = createMarkdownFile(`---
title:
---

Body`);

    const result = runCli(["--format", "json", filePath]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      checkedFileCount: 1,
      issueCount: 1,
      files: [
        {
          filePath,
          ok: false,
          issues: [
            {
              ruleId: "metadata-required-non-empty",
              message: 'Required metadata field "title" cannot be empty.',
              severity: "error",
              line: 2,
              column: 1,
            },
          ],
        },
      ],
    });
  });

  it("supports linting multiple files in one command", () => {
    const validFilePath = createMarkdownFile(`---
title: Hello
---

Body`, "valid.md");
    const invalidFilePath = createMarkdownFile(`---
title:
---

Body`, "invalid.md");

    const result = runCli([validFilePath, invalidFilePath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      `${validFilePath}: OK\n` +
        `${invalidFilePath}:2:1 error metadata-required-non-empty Required metadata field "title" cannot be empty.\n` +
        "Checked 2 file(s), found 1 issue(s).\n",
    );
    expect(result.stderr).toBe("");
  });

  it("supports linting markdown files from a directory recursively", () => {
    const directory = createDirectory();
    const nestedDirectory = join(directory, "nested");
    mkdirSync(nestedDirectory);

    const validFilePath = join(directory, "valid.md");
    const invalidFilePath = join(nestedDirectory, "invalid.md");
    const ignoredFilePath = join(directory, "notes.txt");

    writeFileSync(
      validFilePath,
      `---
title: Hello
---

Body`,
      "utf8",
    );
    writeFileSync(
      invalidFilePath,
      `---
title:
---

Body`,
      "utf8",
    );
    writeFileSync(ignoredFilePath, "not markdown", "utf8");

    const result = runCli([directory]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      `${invalidFilePath}:2:1 error metadata-required-non-empty Required metadata field "title" cannot be empty.\n` +
        `${validFilePath}: OK\n` +
        "Checked 2 file(s), found 1 issue(s).\n",
    );
    expect(result.stderr).toBe("");
  });

  it("loads rule configuration from an explicit JSON config file", () => {
    const directory = createDirectory();
    const filePath = join(directory, "sample.md");
    const configPath = join(directory, "markdown-lint.config.json");

    writeFileSync(
      filePath,
      `---
summary: Ready
---

Body with spaces   `,
      "utf8",
    );
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          rules: {
            "metadata-required-non-empty": { field: "summary" },
            "no-trailing-spaces": { enabled: false },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = runCli(["--config", configPath, filePath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${filePath}: OK\nChecked 1 file(s), found 0 issue(s).\n`);
    expect(result.stderr).toBe("");
  });

  it("discovers YAML config files from the current working directory", () => {
    const directory = createDirectory();
    const filePath = join(directory, "sample.md");
    const configPath = join(directory, "markdown-lint.config.yaml");

    writeFileSync(
      filePath,
      `---
summary: Ready
---

Body with spaces   `,
      "utf8",
    );
    writeFileSync(
      configPath,
      `rules:
  metadata-required-non-empty:
    field: summary
  no-trailing-spaces:
    enabled: false
`,
      "utf8",
    );

    const result = runCli([filePath], { cwd: directory });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${filePath}: OK\nChecked 1 file(s), found 0 issue(s).\n`);
    expect(result.stderr).toBe("");
  });
});

function createMarkdownFile(content: string, fileName = "sample.md"): string {
  const directory = createDirectory();

  const filePath = join(directory, fileName);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

function createDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "markdown-lint-"));
  createdDirectories.push(directory);
  return directory;
}

function runCli(args: string[], options?: { cwd?: string }) {
  return spawnSync(process.execPath, [cliPath(), ...args], {
    cwd: options?.cwd ?? projectRoot(),
    encoding: "utf8",
  });
}

function cliPath(): string {
  return join(projectRoot(), "src/cli.ts");
}

function projectRoot(): string {
  return "/Users/cesar/Projects/HarnessLintingTest";
}
