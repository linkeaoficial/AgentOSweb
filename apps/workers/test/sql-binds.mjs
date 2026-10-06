// Detecta el bug que tiró prod abajo (06-oct): prepare("SQL con N ?") con
// .bind() de M argumentos => D1_ERROR "Wrong number of parameter bindings".
// Recorre src/index.ts y falla si N != M en cualquier prepare doble-comilla
// seguido de .bind. Los prepare con template literal (backtick) se ignoran a
// propósito: su número de binds se calcula en runtime.
import { readFileSync } from "fs";

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

function splitTopLevel(s) {
  const out = [];
  let depth = 0, cur = "", quote = null;
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function matchParen(s, open) { // open = índice del "("; devuelve índice del ")" que cierra
  let depth = 0, quote = null;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote && s[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

let fails = 0, checked = 0;
const re = /\.prepare\(/g;
let m;
while ((m = re.exec(src))) {
  const open = src.indexOf("(", m.index);
  let i = open + 1;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '"') continue; // template literal o dinámico → fuera
  const closeStr = matchParen(src, open); // cierre del prepare(
  if (closeStr < 0) continue;
  const sql = src.slice(open + 1, closeStr).trim().replace(/^"|"$/g, "");
  if (!sql.includes("?")) continue;
  const after = src.slice(closeStr + 1).match(/^\s*\.bind\(/);
  if (!after) continue;
  const bindOpen = closeStr + 1 + after[0].indexOf("(");
  const bindClose = matchParen(src, bindOpen);
  if (bindClose < 0) continue;
  const args = splitTopLevel(src.slice(bindOpen + 1, bindClose));
  const marks = (sql.match(/\?/g) || []).length;
  checked++;
  if (marks !== args.length) {
    fails++;
    const line = src.slice(0, m.index).split("\n").length;
    console.error(`FAIL línea ${line}: SQL con ${marks} "?" pero .bind() con ${args.length} arg(s)\n  ${sql.slice(0, 120)}`);
  }
}
if (fails) { console.error(`${fails} consulta(s) con bindings malos de ${checked} revisadas`); process.exit(1); }
console.log(`PASS  ${checked} prepare().bind() con conteo de bindings correcto`);
