import { build, context } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CDN_URL = "https://cdn.palitra.io/palitra.js";
const SIZE_BUDGET_BYTES = 12 * 1024;
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

const SNIPPET = `<script>
  (function(w,d,s){
    w.PalitraObject=s;w[s]=w[s]||function(){(w[s].q=w[s].q||[]).push(arguments)};
    var e=d.createElement('script');e.async=1;e.src='${CDN_URL}';
    d.head.appendChild(e);
  })(window,document,'palitra');
  palitra('init','ptok_YOUR_PUBLIC_TOKEN');
</script>
`;

async function writeSnippet() {
  writeFileSync(resolve("dist/snippet.html"), SNIPPET);
}

function checkSize() {
  const bytes = readFileSync(resolve("dist/palitra.js"));
  const gz = gzipSync(bytes).length;
  const raw = bytes.length;
  console.log(`[size] raw=${raw}B gzip=${gz}B budget=${SIZE_BUDGET_BYTES}B`);
  if (gz > SIZE_BUDGET_BYTES) {
    console.error(`[size] FAIL: gzipped size ${gz} exceeds budget ${SIZE_BUDGET_BYTES}`);
    process.exit(1);
  }
}

if (watch) {
  const ctx = await context(config);
  await ctx.watch();
  await writeSnippet();
  console.log("watching...");
} else {
  await build(config);
  await writeSnippet();
  checkSize();
}
