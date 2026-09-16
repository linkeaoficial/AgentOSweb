import { build, transform } from "esbuild";
import { readFileSync, copyFileSync, statSync, mkdirSync } from "fs";

const { code: css } = await transform(readFileSync("src/styles.css", "utf8"), {
  loader: "css",
  minify: true,
});

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: "es2020",
  outfile: "dist/widget.js",
  format: "iife",
  define: { __CSS__: JSON.stringify(css) },
  banner: { js: "/* AgentOSweb widget.js */" },
});

const kb = statSync("dist/widget.js").size / 1024;
console.log(`✅ widget.js compilado en dist/widget.js (${kb.toFixed(1)} KB)`);
// ponytail: raw >20KB por CSS embebido; el tráfico real es gzip (~9 KB) servido por Cloudflare.

copyFileSync("dist/widget.js", "../dashboard/public/widget.js");
console.log("✅ widget.js copiado a apps/dashboard/public/widget.js (vista previa Next)");

// Assets de marca: se resuelven relativos al script (widget.js) → se copian junto a cada vista previa
for (const f of ["imagen/Icono_Chat.png", "imagen/Logo_AgentOSweb_chat.png"]) {
  mkdirSync(`dist/${f.split("/")[0]}`, { recursive: true });
  copyFileSync(`../../${f}`, `dist/${f}`);
  mkdirSync(`../dashboard/public/${f.split("/")[0]}`, { recursive: true });
  copyFileSync(`../../${f}`, `../dashboard/public/${f}`);
}
console.log("✅ assets copiados (Icono_Chat.png, Logo) a dist/ y apps/dashboard/public/imagen/");