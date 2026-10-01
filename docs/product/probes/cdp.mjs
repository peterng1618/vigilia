// Drive the tester's private Chromium over CDP on port 5312.
// Usage: node cdp.mjs <script.mjs>   — the script gets `page`, `seenDialogs`, etc.
import { pathToFileURL } from "node:url";
import { chromium } from "file:///D:/git-repos/vigilia/src/web/node_modules/playwright/index.mjs";

const actionPath = process.argv[2];
const browser = await chromium.connectOverCDP("http://127.0.0.1:5312");
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("127.0.0.1:5311")) ?? context.pages()[0];
if (!page) page = await context.newPage();

const mod = await import(pathToFileURL(actionPath).href);
// A native prompt is auto-dismissed by Playwright, which looks exactly like a
// dead command. Answer with the default value, as a person pressing Enter would.
// Record every dialog so a script can read what the author was actually shown.
const seenDialogs = [];
page.on("dialog", async (d) => {
  seenDialogs.push({ type: d.type(), message: d.message() });
  try { await d.accept(d.type() === "prompt" ? d.defaultValue() : undefined); }
  catch {}
});
try {
  await mod.default({ page, context, browser, chromium, seenDialogs });
} catch (error) {
  console.log("ACTION_ERROR: " + (error && error.stack ? error.stack : String(error)));
}
await browser.close();
