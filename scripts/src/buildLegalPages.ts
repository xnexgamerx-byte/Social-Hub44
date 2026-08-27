import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL_DOCS, type LegalDocKey } from "../../artifacts/yalla-clone/constants/legal.ts";

/**
 * Generate the public legal pages Google Play requires.
 *
 * The store will not accept a policy that only exists inside the app — it
 * needs a URL anyone can open without installing anything. Rather than keep a
 * second copy of the text on a website, this renders the same `LEGAL_DOCS`
 * the app renders, so the two can never disagree.
 *
 * Output lands in `docs/`, which GitHub Pages can serve directly from the
 * repository with no build step.
 *
 *   pnpm --filter @workspace/scripts run build:legal
 */

const APP_NAME = "Viber Tok";
const CONTACT_EMAIL = "xsacexs@gmail.com";
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs");

const PAGES: { key: LegalDocKey; file: string }[] = [
  { key: "privacy", file: "privacy.html" },
  { key: "terms", file: "terms.html" },
];

/** Escape anything that would otherwise be read as markup. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  :root {
    --paper: #ffffff; --ink: #16202b; --ink2: #4d5b68; --ink3: #7d8a96;
    --line: #e2e8ee; --accent: #0e6e6b; --card: #f6f8fa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #0d141b; --ink: #e8eef4; --ink2: #a4b2bf; --ink3: #74828e;
      --line: #24313d; --accent: #48c7c0; --card: #141d26;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink); direction: rtl;
    font-family: "Segoe UI", system-ui, -apple-system, "Noto Sans Arabic", sans-serif;
    font-size: 16px; line-height: 1.9;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 40px 20px 80px; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: .1em; color: var(--accent); }
  h1 { font-size: 30px; margin: 8px 0 6px; line-height: 1.3; }
  .updated { color: var(--ink3); font-size: 13.5px; }
  h2 { font-size: 19px; margin: 32px 0 10px; }
  p { margin: 0 0 12px; color: var(--ink2); }
  nav { display: flex; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
  nav a { color: var(--accent); text-decoration: none; font-size: 14px; font-weight: 600; }
  nav a:hover { text-decoration: underline; }
  footer {
    margin-top: 48px; padding: 16px 18px; border-radius: 12px;
    background: var(--card); color: var(--ink2); font-size: 14px;
  }
  footer a { color: var(--accent); }
`;

function render(key: LegalDocKey): string {
  const doc = LEGAL_DOCS[key];
  const body = doc.sections
    .map(
      (s) =>
        `    <h2>${esc(s.heading)}</h2>\n` +
        s.body.map((line) => `    <p>${esc(line)}</p>`).join("\n"),
    )
    .join("\n\n");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — ${APP_NAME}</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">${APP_NAME}</div>
      <h1>${esc(doc.title)}</h1>
      <div class="updated">آخر تحديث: ${esc(doc.updated)}</div>
      <nav>
        <a href="./privacy.html">سياسة الخصوصية</a>
        <a href="./terms.html">شروط الاستخدام</a>
      </nav>
    </header>

${body}

    <footer>
      للاستفسار أو طلب حذف بياناتك، راسلنا على
      <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.
      يمكنك أيضاً حذف حسابك وكل بياناته مباشرة من داخل التطبيق:
      الضبط ← الحساب والأمان ← حذف الحساب.
    </footer>
  </div>
</body>
</html>
`;
}

function renderIndex(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${APP_NAME}</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">${APP_NAME}</div>
      <h1>المستندات القانونية</h1>
      <div class="updated">تطبيق دردشة صوتية وتواصل اجتماعي</div>
    </header>
    <h2>سياسة الخصوصية</h2>
    <p>ما نجمعه من بيانات، وليش، وكيف تحذفه. <a href="./privacy.html">اقرأها</a></p>
    <h2>شروط الاستخدام</h2>
    <p>قواعد استخدام التطبيق وحقوقك والتزاماتك. <a href="./terms.html">اقرأها</a></p>
    <footer>
      للتواصل: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
    </footer>
  </div>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
// Stops GitHub Pages running the output through Jekyll, which would ignore
// files it does not recognise.
writeFileSync(resolve(OUT_DIR, ".nojekyll"), "");
writeFileSync(resolve(OUT_DIR, "index.html"), renderIndex());
for (const { key, file } of PAGES) {
  writeFileSync(resolve(OUT_DIR, file), render(key));
  console.log(`wrote docs/${file}`);
}
console.log("wrote docs/index.html");
