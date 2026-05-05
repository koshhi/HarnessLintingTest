import { spawn } from "node:child_process";

console.log("Starting VS Code extension watcher...");
console.log("");
console.log("Recommended development flow:");
console.log("1. Open the repository root in VS Code.");
console.log('2. Run "Run Markdown Lint Extension" from Run and Debug and press F5 once.');
console.log("3. Keep this watcher running.");
console.log('4. After code changes, use "Developer: Reload Window" in the Extension Development Host.');
console.log("");
console.log("You do not need to reinstall a VSIX when only changing rules or extension code during development.");
console.log("");

const child = spawn("npm", ["--prefix", "./vscode-extension", "run", "watch"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
