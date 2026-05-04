import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode"],
  format: "cjs",
  outfile: "dist/extension.js",
  platform: "node",
  sourcemap: true,
  target: "node20",
});

if (watch) {
  await ctx.watch();
  console.log("Watching VS Code extension sources...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Built VS Code extension.");
}
