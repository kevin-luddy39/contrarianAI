/**
 * Bell Tuning Cloud dashboard — vanilla JS, no build step.
 *
 * Reads ?ws=<workspaceId> from the URL, hits /api/workspace/:id/state
 * and /events, and renders the page. Refreshes every 15 seconds.
 */

const params = new URLSearchParams(location.search);
const WS_ID = params.get('ws');

const SENSORS = ['context-inspector', 'retrieval-auditor', 'tool-call-grader', 'predictor-corrector'];

function regimeClass(r) { return 'regime-' + (r || 'healthy'); }

function fmt(v, d = 3) { return typeof v === 'number' ? v.toFixed(d) : '—'; }

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

function renderSparkline(svg, points) {
  svg.innerHTML = '';
  if (points.length === 0) return;
  const ns = 'http://www.w3.org/2000/svg';
  const W = 200, H = 40, pad = 2;
  const xs = points.map((_, i) => pad + (i / Math.max(points.length - 1, 1)) * (W - 2 * pad));
  const ys = points.map(p => {
    const v = (p == null) ? 0.5 : p;
    return pad + (1 - v) * (H - 2 * pad);
  });
  const path = document.createElementNS(ns, 'polyline');
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  path.setAttribute('points', pts);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#1a1a2e');
  path.setAttribute('stroke-width', '1.5');
  svg.appendChild(path);

  // Dot for last point
  const lastDot = document.createElementNS(ns, 'circle');
  lastDot.setAttribute('cx', xs[xs.length - 1]);
  lastDot.setAttribute('cy', ys[ys.length - 1]);
  lastDot.setAttribute('r', '2.5');
  lastDot.setAttribute('fill', regimeColor(points[points.length - 1]));
  svg.appendChild(lastDot);
}

function regimeColor(v) {
  if (v == null) return '#888';
  if (v >= 0.85) return '#1b7e3a';
  if (v >= 0.60) return '#a66';
  if (v >= 0.30) return '#c8470d';
  return '#a3040f';
}

function regimeLabel(v) {
  if (v == null) return '—';
  if (v >= 0.85) return 'healthy';
  if (v >= 0.60) return 'drift';
  if (v >= 0.30) return 'contamination';
  return 'rot';
}

function renderAggregateChart(svg, eventsByTs) {
  svg.innerHTML = '';
  const W = 800, H = 200;
  const keys = Object.keys(eventsByTs).sort();
  if (keys.length < 2) return;
  const ns = 'http://www.w3.org/2000/svg';

  // Draw horizontal threshold bands
  const bands = [
    { y0: 0.00, y1: 0.30, color: '#fde2e0' },   // rot
    { y0: 0.30, y1: 0.60, color: '#fdecd3' },   // contamination
    { y0: 0.60, y1: 0.85, color: '#fdf9d3' },   // drift
    { y0: 0.85, y1: 1.00, color: '#dff4e3' },   // healthy
  ];
  for (const b of bands) {
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', (1 - b.y1) * H);
    rect.setAttribute('width', W);
    rect.setAttribute('height', (b.y1 - b.y0) * H);
    rect.setAttribute('fill', b.color);
    svg.appendChild(rect);
  }

  // Line = min(health) across sensors at each timestamp
  const pts = keys.map((ts, i) => {
    const healths = Object.values(eventsByTs[ts]).map(e => e.health).filter(h => h != null);
    const agg = healths.length ? Math.min(...healths) : null;
    const x = (i / (keys.length - 1)) * W;
    const y = (agg == null) ? H / 2 : (1 - agg) * H;
    return { x, y, agg };
  });
  const poly = document.createElementNS(ns, 'polyline');
  poly.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', '#1a1a2e');
  poly.setAttribute('stroke-width', '2');
  svg.appendChild(poly);

  // Dots
  for (const p of pts) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x);
    c.setAttribute('cy', p.y);
    c.setAttribute('r', '3');
    c.setAttribute('fill', regimeColor(p.agg));
    svg.appendChild(c);
  }
}

async function render() {
  if (!WS_ID) {
    document.querySelector('.dashboard').innerHTML =
      '<div class="card"><p>No workspace selected. Visit <code>/?ws=&lt;id&gt;</code>.</p></div>';
    return;
  }
  try {
    const [state, events] = await Promise.all([
      api(`/api/workspace/${WS_ID}/state`),
      api(`/api/workspace/${WS_ID}/events?limit=500`),
    ]);

    document.getElementById('workspace-name').textContent = state.workspace.name;

    // Summary: compute worst-signal health across sensors
    const latest = state.latest;
    const healths = SENSORS.map(s => latest[s]?.health).filter(h => h != null);
    const overall = healths.length ? Math.min(...healths) : null;
    document.getElementById('overall-value').textContent  = fmt(overall, 2);
    document.getElementById('overall-value').style.color  = regimeColor(overall);
    document.getElementById('overall-regime').textContent = regimeLabel(overall);
    document.getElementById('overall-regime').className   = 'regime ' + regimeClass(regimeLabel(overall));

    // Pathology count = sum across latest events
    let pathologyTotal = 0;
    const allPathologies = [];
    for (const sensor of SENSORS) {
      const ev = latest[sensor];
      if (!ev) continue;
      const n = ev.pathologyCount || 0;
      pathologyTotal += n;
      const pathologies = ev.payload?.pathologies || [];
      for (const p of pathologies) {
        allPathologies.push({ ts: ev.ts, sensor, kind: p.kind, severity: p.severity });
      }
    }
    document.getElementById('pathology-count').textContent = pathologyTotal;
    document.getElementById('pathology-count').style.color =
      pathologyTotal === 0 ? '#1b7e3a' : (pathologyTotal < 3 ? '#a66' : '#a3040f');

    // Pathology log table
    const tbody = document.querySelector('#pathology-table tbody');
    tbody.innerHTML = '';
    allPathologies.sort((a, b) => b.severity - a.severity).slice(0, 10).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(p.ts).toLocaleString()}</td>
        <td><code>${p.sensor}</code></td>
        <td><strong>${p.kind}</strong></td>
        <td>${p.severity?.toFixed(2) ?? '—'}</td>`;
      tbody.appendChild(tr);
    });

    // Per-sensor cards + sparklines
    const byTs = {};
    for (const sensor of SENSORS) {
      const sel = `#sensor-${sensor}`;
      const ev = latest[sensor];
      if (ev) {
        document.querySelector(`${sel} .sensor-value`).textContent = fmt(ev.health, 3);
        document.querySelector(`${sel} .sensor-value`).style.color = regimeColor(ev.health);
        document.querySelector(`${sel} .sensor-regime`).textContent = ev.regime || regimeLabel(ev.health);
      }
      const sensorEvents = events.filter(e => e.sensor === sensor).reverse();
      const healthPoints = sensorEvents.map(e => e.health).filter(h => h != null);
      renderSparkline(document.querySelector(`${sel} svg.sparkline`), healthPoints.slice(-30));

      for (const e of sensorEvents) {
        byTs[e.ts] = byTs[e.ts] || {};
        byTs[e.ts][e.sensor] = e;
      }
    }

    renderAggregateChart(document.getElementById('aggregate-chart'), byTs);

    // Report download links
    document.getElementById('download-md').href   = `/api/workspace/${WS_ID}/report?format=markdown`;
    document.getElementById('download-html').href = `/api/workspace/${WS_ID}/report?format=html`;
    document.getElementById('view-events').href   = `/api/workspace/${WS_ID}/events`;
  } catch (e) {
    console.error(e);
    document.querySelector('.dashboard').innerHTML =
      `<div class="card"><p style="color:#a3040f">Error: ${e.message}</p></div>`;
  }
}

render();
setInterval(render, 15_000);
