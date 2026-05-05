import { rmSync } from "node:fs";
import { join } from "node:path";

rmSync(join(process.cwd(), "dist", "markdown-lint-prototype.vsix"), { force: true });
rmSync(join(process.cwd(), "markdown-lint-prototype.vsix"), { force: true });
