import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"));
const { marked } = require("marked");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mdPath = path.join(__dirname, "RuleShark-Overview.md");
const htmlPath = path.join(__dirname, "RuleShark-Overview.html");
const pdfPath = path.join(__dirname, "RuleShark-Overview.pdf");

const md = readFileSync(mdPath, "utf8");
const body = marked.parse(md);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>RuleShark Overview</title>
  <style>
    body {
      font-family: "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      max-width: 800px;
      margin: 24px auto;
      padding: 0 16px;
    }
    h1 { font-size: 22pt; border-bottom: 2px solid #0b3d5c; padding-bottom: 8px; }
    h2 { font-size: 14pt; margin-top: 1.4em; color: #0b3d5c; }
    h3 { font-size: 12pt; }
    code, pre { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }
    pre {
      background: #f4f6f8;
      padding: 12px;
      border-radius: 6px;
      white-space: pre-wrap;
    }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  </style>
</head>
<body>
${body}
</body>
</html>
`;

writeFileSync(htmlPath, html, "utf8");

const chromeCandidates = [
  path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
];

const browser = chromeCandidates.find((p) => p && existsSync(p));
if (!browser) {
  console.error("No Chrome/Edge found to print PDF.");
  process.exit(1);
}

const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
const result = spawnSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ],
  { cwd: root, encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "Chrome print failed");
  process.exit(result.status || 1);
}

if (!existsSync(pdfPath)) {
  console.error("PDF was not created:", pdfPath);
  process.exit(1);
}

console.log("Wrote", pdfPath);
