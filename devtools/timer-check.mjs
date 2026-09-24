// Serve the repository and drive the Time Tracker in headless Chromium with a
// fake clock: stop the timer after 59 s, then after 61 s, and report what was
// saved each time. Needs the `playwright` package and its Chromium build.
//
//   node devtools/timer-check.mjs

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
console.log(`chromium ${browser.version()}`);
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.install({ time: new Date('2026-09-24T10:00:00') });
await page.goto(`${base}/tools/time-tracker/index.html`);
await page.waitForSelector('#timerStartBtn');
// The timer only starts in edit mode.
await page.evaluate(() => document.getElementById('editToggle').click());

const saved = () => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('ganttProject') || '{}').timeEntries || []).length);

async function run(seconds) {
  const before = await saved();
  // Click through the DOM: the fake clock also holds requestAnimationFrame,
  // which Playwright's own click waits on.
  await page.evaluate(() => document.getElementById('timerStartBtn').click());
  await page.clock.fastForward(seconds * 1000);
  const shown = await page.textContent('#timerDisplay');
  await page.evaluate(() => document.getElementById('timerStopBtn').click());
  await page.clock.runFor(1000);
  const status = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => !el.children.length && /too short|Logged/.test(el.textContent))
      .map((el) => el.textContent.trim()).join(' | '));
  const last = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('ganttProject') || '{}').timeEntries || []).at(-1));
  console.log(`stop after ${seconds}s: display ${shown}, entries ${before} -> ${await saved()}, status "${status}"`);
  if (await saved() > before) console.log(`  saved entry: ${last.date} ${last.startTime}-${last.endTime}`);
}

await run(59);
await run(61);
console.log(`page errors: ${errors.length ? errors.join('; ') : 'none'}`);
await browser.close();
server.close();
