import { build } from "esbuild";

const watch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/palitra.js",
  bundle: true,
  format: "iife",
  target: "es2019",
  minify: true,
  treeShaking: true,
  sourcemap: "external",
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const ctx = await (await import("esbuild")).context(config);
  await ctx.watch();
  console.log("watching...");
} else {
  await build(config);
}
