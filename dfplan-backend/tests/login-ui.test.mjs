import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../dfplan/cloud-ui.js', import.meta.url), 'utf8');
const { cloudGate, loginHelp, syncLoginGuidance } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const h = { s: (zh, en) => zh, esc: v => String(v).replaceAll('<', '&lt;').replaceAll('"', '&quot;'), icon: n => `<svg data-icon="${n}"></svg>`, readingControl: '<button data-action="text-size">Aa</button>' };
globalThis.document = { documentElement: { lang: 'zh-CN' } };
test('signed-out gate offers real sign-in and no simulated or success state', () => {
  const html = cloudGate({ phase: 'signed-out' }, true, '', h);
  assert.match(html, /data-action="cloud-login"/);
  assert.match(html, /data-action="text-size"/);
  assert.doesNotMatch(html, /simNormal|simUnauth|authSuccess|setTimeout|cdn.tailwind/);
});
test('permission checking never offers login or invitation redemption', () => {
  for (const phase of ['connecting', 'checking', 'reading']) {
    const html = cloudGate({ phase, invite: true }, true, '', h);
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, /data-action="cloud-(login|link-login|initialize)"/);
  }
});
test('invitation retains its real redemption action and owner keeps initialization', () => {
  assert.match(cloudGate({ phase: 'signed-out', invite: true }, true, '', h), /data-action="cloud-link-login"/);
  const html = cloudGate({ phase: 'not-initialized', admin: { role: 'owner' } }, true, '', h);
  assert.match(html, /data-action="cloud-initialize"/);
  assert.doesNotMatch(html, /data-action="cloud-login"/);
});
test('denied and unavailable states remain honest and escape account/error content', () => {
  const html = cloudGate({ phase: 'denied', user: { email: '<account>' } }, false, '<network>', h);
  assert.match(html, /gate-denied/);
  assert.match(html, /data-action="cloud-logout"/);
  assert.match(html, /data-action="cloud-refresh"/);
  assert.match(html, /data-action="cloud-login" disabled/);
  assert.doesNotMatch(html, /<account>|<network>/);
});
test('English gate uses language selection and translated help', () => {
  document.documentElement.lang = 'en';
  const html = cloudGate({ phase: 'signed-out' }, true, '', { ...h, s: (zh, en) => en });
  assert.match(html, /data-lang="en" aria-pressed="true"/);
  assert.match(html, /Sign in with Google/);
  assert.match(html, /Add to home screen/);
});
test('access request copies only the canonical URL; copy failure offers manual text', async () => {
  let copied, toast, opened = 0;
  const body = { innerHTML: '' };
  const dialog = { isConnected: true, querySelector: () => body, showModal() { opened++; } };
  document.getElementById = () => dialog;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text) { copied = text; } } } });
  try {
    await loginHelp('gate-request', { ...h, toast: text => toast = text });
    assert.match(copied, /https:\/\/dcdeeptech.com\/dfplan\//);
    assert.doesNotMatch(copied, /#invite=|token|email=/);
    assert.match(toast, /已复制/);
    assert.equal(opened, 0);
    navigator.clipboard.writeText = async () => { throw Error('blocked'); };
    toast = '';
    await loginHelp('gate-request', { ...h, toast: text => toast = text });
    assert.equal(toast, '');
    assert.match(body.innerHTML, /textarea readonly/);
    assert.equal(opened, 1);
    await loginHelp('gate-privacy', h);
    assert.match(body.innerHTML, /noindex 不是访问保护/);
    await loginHelp('gate-home', h);
    assert.match(body.innerHTML, /Samsung Internet/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});

test('denial guidance uses verified session email and account switch invokes the real login action', async () => {
  const body = { innerHTML: '' };
  const dialog = { isConnected: true, open: false, querySelector: () => body, showModal() { this.open = true; } };
  document.getElementById = () => dialog;
  await loginHelp('gate-denied', { ...h, session: { phase: 'signed-out', user: { email: 'fake@example.com' } } });
  assert.equal(dialog.open, false);
  await loginHelp('gate-denied', { ...h, session: { phase: 'denied', user: { email: '<blocked>@example.com' } } });
  assert.equal(dialog.open, true);
  assert.match(body.innerHTML, /&lt;blocked>@example.com/);
  assert.match(body.innerHTML, /data-action="cloud-login"/);
  assert.doesNotMatch(body.innerHTML, /family.member@gmail.com/);
});

test('browser help switches systems, preserves invitation guidance and copies no invitation secret', async () => {
  const body = { innerHTML: '' };
  let opened = 0;
  const dialog = { isConnected: true, open: false, querySelector: () => body, showModal() { this.open = true; opened++; } };
  document.getElementById = () => dialog;
  await loginHelp('gate-browser-android', { ...h, session: { invite: true } });
  assert.match(body.innerHTML, /Samsung Internet 或 Chrome/);
  assert.match(body.innerHTML, /原专属链接/);
  await loginHelp('gate-browser-ios', h);
  assert.match(body.innerHTML, /使用 Safari/);
  assert.equal(opened, 1);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied = '';
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text) { copied = text; } } } });
  try {
    document.documentElement.lang = 'en';
    await loginHelp('gate-copy-url', { ...h, session: { invite: true }, toast() {} });
    assert.equal(copied, 'https://dcdeeptech.com/dfplan/?lang=en');
    await loginHelp('gate-request', { ...h, session: { phase: 'denied', user: { email: 'blocked@example.com' } }, toast() {} });
    assert.match(copied, /blocked@example.com/);
    assert.doesNotMatch(copied, /#invite=|error=|token=/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});

test('guidance follows backend denial once and never interprets URL errors as authorization', () => {
  let opened = 0;
  const body = { innerHTML: '' };
  document.getElementById = () => ({ isConnected: true, open: false, querySelector: () => body, showModal() { opened++; } });
  const session = { phase: 'denied', user: { uid: 'blocked-user', email: 'blocked@example.com' } };
  syncLoginGuidance({ phase: 'checking' }, h);
  assert.equal(opened, 0);
  syncLoginGuidance(session, h);
  syncLoginGuidance(session, h);
  assert.equal(opened, 1);
  syncLoginGuidance({ phase: 'signed-out' }, h);
  syncLoginGuidance(session, h);
  assert.equal(opened, 2);
});
