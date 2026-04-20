#!/usr/bin/env node
/**
 * Bell Tuning Cloud smoke tests.
 *
 * Starts the server in-process on a random port, runs through the
 * workspace-create → ingest → state → report cycle, and confirms
 * responses. Uses a temp SQLite file so nothing leaks into the real DB.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.BELL_TUNING_ADMIN_TOKEN = 'test-admin-token';

async function main() {
  const tmpDb = path.join(os.tmpdir(), `btc-test-${Date.now()}.sqlite`);
  const db = require('../db');
  await db.init({ file: tmpDb });

  const { app } = require('../server');
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  let pass = 0, fail = 0;
  const test = async (name, fn) => {
    try { await fn(); pass++; console.log(`  ok  ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.stack || e.message}`); }
  };

  // Create workspace
  const ws = await http_post(`${base}/api/workspaces`, { name: 'test-ws' }, { 'x-admin-token': 'test-admin-token' });
  await test('workspace creation returns apiKey', () => {
    if (!ws.apiKey || !ws.id) throw new Error('missing fields');
  });

  // Ingest events
  for (const sensor of ['context-inspector', 'retrieval-auditor', 'tool-call-grader']) {
    const body = {
      sensor,
      payload: { health: 0.7, regime: 'drift', pathologies: [{ kind: 'TEST', severity: 0.3, description: 't' }] },
    };
    const r = await http_post(`${base}/api/ingest`, body, { authorization: `Bearer ${ws.apiKey}` });
    await test(`ingest ${sensor}`, () => { if (!r.ok) throw new Error(JSON.stringify(r)); });
  }

  // Ingest rejects unknown sensor
  await test('ingest rejects unknown sensor', async () => {
    const r = await http_post(`${base}/api/ingest`, { sensor: 'nope', payload: {} }, { authorization: `Bearer ${ws.apiKey}` });
    if (!r.error) throw new Error('expected error for unknown sensor');
  });

  // Unauth rejected
  await test('ingest without API key is rejected', async () => {
    const r = await http_post(`${base}/api/ingest`, { sensor: 'context-inspector', payload: {} }, {});
    if (!r.error) throw new Error('expected 401');
  });

  // Read state
  const state = await http_get(`${base}/api/workspace/${ws.id}/state`);
  await test('workspace state reflects ingested events', () => {
    if (!state.latest['context-inspector']) throw new Error('missing context-inspector');
    if (!state.latest['retrieval-auditor']) throw new Error('missing retrieval-auditor');
  });

  // Download report
  const report = await http_get_raw(`${base}/api/workspace/${ws.id}/report?format=markdown`);
  await test('report download returns markdown', () => {
    if (!report.includes('# Bell Tuning Audit')) throw new Error('no heading');
    if (!report.includes('## Executive Summary')) throw new Error('no exec summary');
  });

  const html = await http_get_raw(`${base}/api/workspace/${ws.id}/report?format=html`);
  await test('report download returns HTML', () => {
    if (!html.startsWith('<!DOCTYPE html>')) throw new Error('not html');
  });

  server.close();
  try { fs.unlinkSync(tmpDb); } catch {}
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

function http_post(url, body, headers = {}) { return request(url, { method: 'POST', body, headers }); }
function http_get(url, headers = {})        { return request(url, { method: 'GET', headers }); }
async function http_get_raw(url)            {
  const r = await fetch(url);
  return r.text();
}
async function request(url, { method, body, headers = {} }) {
  const r = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { status: r.status, text: txt }; }
}

main();
