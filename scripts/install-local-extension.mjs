import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionDir = join(repoRoot, "vscode-extension");
const vsixPath = join(extensionDir, "markdown-lint-prototype.vsix");

run("npm", ["--prefix", extensionDir, "run", "pack"], repoRoot);

if (!existsSync(vsixPath)) {
  console.error(`Expected VSIX package at "${vsixPath}", but it was not created.`);
  process.exit(1);
}

const codeCommand = findCodeCommand();

if (!codeCommand) {
  console.error("VS Code CLI not found in PATH.");
  console.error(`Install manually from VSIX using: ${vsixPath}`);
  console.error('In VS Code, run "Extensions: Install from VSIX..." and pick that file.');
  process.exit(1);
}

run(codeCommand, ["--install-extension", vsixPath, "--force"], repoRoot);

console.log("");
console.log("Local VS Code extension installed.");
console.log("If VS Code is already open, run \"Developer: Reload Window\" to load the updated build.");

function findCodeCommand() {
  for (const candidate of ["code", "code-insiders"]) {
    const result = spawnSync(candidate, ["--version"], {
      cwd: repoRoot,
      stdio: "ignore",
      shell: process.platform === "win32",
    });

    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
