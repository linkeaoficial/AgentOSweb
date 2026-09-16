import { build } from "esbuild";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const out = join(tmpdir(), `agentos-fallback-${Date.now()}.mjs`);
await build({
  entryPoints: ["src/fallback.ts"],
  bundle: true,
  format: "esm",
  outfile: out,
});

const { localReply, DEFAULT_CONFIG } = await import(pathToFileURL(out).href);

const assert = (cond, label) => {
  if (!cond) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  console.log("ok:", label);
};

assert(localReply("¿cómo lo instalo en mi web?").includes("script"), "respuesta instalación");
assert(localReply("explica BYOK por favor").includes("BYOK"), "respuesta BYOK");
assert(localReply("¿cuánto cuesta el plan pro?").includes("$79"), "respuesta planes");
assert(localReply("hola mundo").includes(DEFAULT_CONFIG.header_title), "respuesta genérica");

console.log("check OK");