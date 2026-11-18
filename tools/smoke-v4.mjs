#!/usr/bin/env node
// Mosslight Courier — V4 local smoke test and screenshot capture.
//
// A private V4 verification script: it lives outside game/, so it never
// enters the published dossier, and it exists so V2/V3 evidence is never
// touched — V4 captures and reports come from this script alone.
//
// It serves game/ over loopback with serve.ts, drives a local headless
// Chrome over the DevTools protocol (Node's built-in WebSocket client, no
// dependencies), gives Chrome a unique throwaway profile so the route map
// always starts from a fresh save, captures the four fixture screenshots
// from the game's own renderer, and walks title → run → pause → route →
// reselect while watching for JavaScript exceptions and any request that
// leaves localhost.
//
// Usage:
//   node tools/smoke-v4.mjs [--port 8130] [--chrome /path/to/chrome]
//       [--skip-shots] [--skip-smoke] [--out <screenshots dir>]
//
// Everything here is local: loopback HTTP and a local browser only.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url)); // <repo>/tools
const root = dirname(here); // the repository root

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const PORT = Number(flag('--port', '8130'));
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = flag('--out', join(root, 'screenshots'));
const SKIP_SHOTS = has('--skip-shots');
const SKIP_SMOKE = has('--skip-smoke');

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chrome',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
  '/opt/google/chrome/google-chrome',
].filter(Boolean);

function findChrome() {
  const given = flag('--chrome', null);
  if (given) return given;
  return CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

const failures = [];
const notes = [];
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
  return ok;
}
function note(label) {
  console.log(`NOTE ${label}`);
  notes.push(label);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ CDP client

/** A minimal DevTools-protocol client over Node's built-in WebSocket. */
class Cdp {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.ws = null;
  }

  async connect() {
    if (typeof WebSocket !== 'function') {
      throw new Error('this Node build has no global WebSocket client');
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`cdp ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of [...this.listeners]) fn(msg);
      }
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('the CDP websocket failed')), {
        once: true,
      });
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`cdp timeout: ${method}`));
        }
      }, 20000);
    });
  }

  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

// ------------------------------------------------------------- browser

/** Reads the "DevTools listening on ws://…" line from Chrome's stderr. */
function readDevtoolsUrl(stderr) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome gave no devtools URL')), 15000);
    stderr.on('data', (chunk) => {
      buf += String(chunk);
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    stderr.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function waitForServer(origin) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(origin);
      if (res.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`the static server never came up at ${origin}`);
}

async function openPage(cdp, url, watched) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  // Pin each target to the game's logical viewport: a headless window's
  // inner size (1280×633 here) is not the 1280×720 the shots must be.
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  const off = cdp.onEvent((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      watched.errors.push(`exception: ${d.text} ${d.exception?.description ?? ''}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      watched.errors.push(`console.error: ${msg.params.args.map(String).join(' ')}`);
    } else if (msg.method === 'Network.requestWillBeSent') {
      const u = msg.params.request.url;
      if (u.startsWith(ORIGIN) || u.startsWith('devtools://')) return;
      // Chrome's own internals are not the game's requests.
      if (u.startsWith('http://127.0.0.1') || u.startsWith('about:')) return;
      watched.offsite.push(u);
    }
  });
  await cdp.send('Page.navigate', { url }, sessionId);
  await sleep(600);
  return { sessionId, targetId, off };
}

async function closePage(cdp, page) {
  page.off();
  await cdp.send('Target.closeTarget', { targetId: page.targetId });
}

/** Evaluates an expression, returning its JSON value. */
async function evalJson(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true },
    sessionId,
  );
  return res.result?.value ?? null;
}

async function probe(cdp, sessionId) {
  return evalJson(cdp, sessionId, 'JSON.stringify(window.__probe ? window.__probe() : null)');
}

/** Waits until the expression is true (the fixtures set window.__shotReady). */
async function waitUntil(cdp, sessionId, expression, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await evalJson(cdp, sessionId, expression)) return true;
    await sleep(120);
  }
  return false;
}

const KEY_CODES = {
  Enter: { code: 'Enter', vk: 13 },
  p: { code: 'KeyP', vk: 80 },
  b: { code: 'KeyB', vk: 66 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
};

async function pressKey(cdp, sessionId, keyName) {
  const k = KEY_CODES[keyName];
  await cdp.send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', key: keyName, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk },
    sessionId,
  );
  await cdp.send(
    'Input.dispatchKeyEvent',
    { type: 'keyUp', key: keyName, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk },
    sessionId,
  );
}

/** Raw HTTP response (status + body) with no client-side URL normalization. */
function rawResponse(path) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------- flow

async function captureShots(cdp) {
  mkdirSync(OUT, { recursive: true });
  const shots = [
    ['map', '01-title.jpg'],
    ['play', '02-gameplay.jpg'],
    ['win', '03-victory.jpg'],
    ['lose', '04-loss.jpg'],
  ];
  for (const [shot, file] of shots) {
    const watched = { errors: [], offsite: [] };
    const page = await openPage(cdp, `${ORIGIN}/?shot=${shot}`, watched);
    const ready = await waitUntil(cdp, page.sessionId, 'window.__shotReady === true', 20000);
    if (!check(ready, `fixture ${shot} rendered (window.__shotReady)`)) {
      note(`fixture ${shot}: ${watched.errors.join('; ') || 'readiness never set'}`);
    }
    const shotData = await cdp.send(
      'Page.captureScreenshot',
      { format: 'jpeg', quality: 92 },
      page.sessionId,
    );
    writeFileSync(join(OUT, file), Buffer.from(shotData.data, 'base64'));
    console.log(`SHOT ${file} written`);
    await closePage(cdp, page);
  }
}

async function smoke(cdp) {
  const watched = { errors: [], offsite: [] };
  const page = await openPage(cdp, `${ORIGIN}/`, watched);
  await sleep(900); // let the route map settle

  let p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.phase === 'map', 'title opens on the route map', JSON.stringify(p));

  await pressKey(cdp, page.sessionId, 'Enter');
  await sleep(800);
  p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.phase === 'running', 'Enter departs into a run', JSON.stringify(p));

  await pressKey(cdp, page.sessionId, 'p');
  await sleep(500);
  p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.phase === 'paused', 'P pauses the run', JSON.stringify(p));

  await pressKey(cdp, page.sessionId, 'b');
  await sleep(600);
  p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.phase === 'map', 'B abandons to the route', JSON.stringify(p));

  // Reselect: only the first grove is open on a fresh save, so ArrowRight
  // keeps the selection and Enter re-departs from it.
  const sel0 = p ? p.sel : null;
  await pressKey(cdp, page.sessionId, 'ArrowRight');
  await sleep(400);
  p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.sel === sel0, 'the locked next grove cannot be selected', JSON.stringify(p));
  await pressKey(cdp, page.sessionId, 'Enter');
  await sleep(800);
  p = JSON.parse((await probe(cdp, page.sessionId)) ?? 'null');
  check(p && p.phase === 'running', 'Enter re-departs on the selected grove', JSON.stringify(p));

  // The relay is live in the fresh run: three beacons laid, none lit yet.
  check(p && p.waylights === 0, 'the fresh run starts with an unlit relay', JSON.stringify(p));

  check(watched.errors.length === 0, 'no JavaScript exceptions or console errors', watched.errors.join('; '));
  check(watched.offsite.length === 0, 'no requests outside localhost', watched.offsite.join('; '));
  await closePage(cdp, page);

  // Malformed URL behavior: traversal and invalid-percent paths must be
  // refused safely — either 400 (malformed request) or 404 (safe refusal) —
  // and the response body must never carry the refused file's contents.
  const LEAK_MARKERS = ['# Mosslight Courier', 'MIT License', 'Permission is hereby granted'];
  const refused = async (path, label) => {
    const { status, body } = await rawResponse(path);
    const leak = LEAK_MARKERS.some((m) => body.includes(m));
    const ok = (status === 400 || status === 404) && !leak;
    check(
      ok,
      label,
      `status ${status}${leak ? ' — response leaked file content' : ''}`,
    );
    return ok;
  };
  await refused('/..%2f..%2fREADME.md', 'a traversal URL is refused without leaking the file');
  await refused('/%2e%2e/%2e%2e/LICENSE', 'an encoded traversal URL is refused without leaking the file');
  // An invalid percent escape is a malformed request line, not a lookup:
  // the server must answer 400 for exactly that.
  {
    const { status, body } = await rawResponse('/%ZZ');
    const leak = LEAK_MARKERS.some((m) => body.includes(m));
    check(status === 400 && !leak, 'an invalid percent escape is refused with HTTP 400', `status ${status}`);
  }
}

/**
 * Stops a child process politely, then forcefully, waiting for its actual
 * exit at each stage — `kill()` alone returns before the process is gone,
 * which used to leave Chrome holding the temporary profile while it was
 * deleted. Safe on a child that already exited or was never started.
 */
async function terminate(proc, graceMs = 2000) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise((resolve) => proc.once('exit', resolve));
  proc.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, graceMs).unref())]);
  if (proc.exitCode === null && proc.signalCode === null) {
    proc.kill('SIGKILL');
    await Promise.race([exited, new Promise((r) => setTimeout(r, graceMs).unref())]);
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('No Chrome found. Pass --chrome /path/to/chrome or set CHROME_BIN.');
    process.exit(2);
  }
  console.log(`Chrome: ${chrome}`);

  // A unique throwaway profile per run: the route map must start from a
  // fresh save (no groves lit), never from whatever an earlier Chrome
  // session kept in the default profile directory. Removed in finally.
  const userDataDir = mkdtempSync(join(tmpdir(), 'mosslight-smoke-'));
  console.log(`Chrome profile: ${userDataDir} (fresh save, removed afterwards)`);

  const server = spawn(process.execPath, [join(root, 'serve.ts')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => console.error(`serve: ${d}`));

  const chromeProc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      '--window-size=1280,720',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let cdp = null;
  try {
    await waitForServer(ORIGIN);
    console.log(`serving ${ORIGIN}`);

    const wsUrl = await readDevtoolsUrl(chromeProc.stderr);
    cdp = new Cdp(wsUrl);
    await cdp.connect();

    try {
      // The smoke walk runs first, against the profile's untouched fresh
      // save; the screenshot fixtures run after because they intentionally
      // seed their own campaign progress (?shot=map etc.), which would
      // otherwise leak into the route-map checks.
      if (!SKIP_SMOKE) await smoke(cdp);
      if (!SKIP_SHOTS) await captureShots(cdp);
    } finally {
      cdp.close();
    }
  } finally {
    try {
      // Wait for each process to really die before deleting its profile:
      // SIGTERM, a short grace, then SIGKILL if still alive.
      await Promise.all([terminate(chromeProc), terminate(server)]);
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`SMOKE FAILED: ${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log('SMOKE PASSED: all checks green (local only)');
}

main().catch((err) => {
  console.error(`smoke aborted: ${err.message}`);
  process.exitCode = 1;
});
