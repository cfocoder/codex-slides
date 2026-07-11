import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const english = read("src/i18n/locales/en.ts");
const sourceKeys = new Set([...english.matchAll(/^\s+"([^"]+)":/gm)].map((match) => match[1]));

if (!sourceKeys.size) throw new Error("English i18n dictionary has no keys");

const localeType = read("src/i18n/types.ts");
const localeMatch = localeType.match(/export const LOCALES:[^=]+ = \[([^\]]+)\]/);
if (!localeMatch) throw new Error("Could not read LOCALES from src/i18n/types.ts");
const locales = [...localeMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);

for (const locale of locales) {
  const file = `src/i18n/locales/${locale}.ts`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing locale dictionary: ${file}`);
}

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !file.includes(`${path.sep}locales${path.sep}`)) sourceFiles.push(file);
  }
}
walk(path.join(root, "src"));

const unknown = [];
for (const file of sourceFiles) {
  const body = fs.readFileSync(file, "utf8");
  for (const match of body.matchAll(/\bt\(\s*"([^"]+)"/g)) {
    if (!sourceKeys.has(match[1])) unknown.push(`${path.relative(root, file)}: ${match[1]}`);
  }
}
if (unknown.length) throw new Error(`Unknown i18n keys:\n${unknown.join("\n")}`);

const legacy = sourceFiles.filter((file) => fs.readFileSync(file, "utf8").includes("随意输入"));
if (legacy.length) throw new Error(`Legacy copy \"随意输入\" remains in:\n${legacy.map((file) => path.relative(root, file)).join("\n")}`);

process.stdout.write(`i18n check passed: ${locales.length} locales, ${sourceKeys.size} source keys\n`);

