/**
 * audit-report-generator — main entry.
 *
 * generateReport({
 *   title, client, auditor, date,
 *   contextInspector, retrievalAuditor, toolCallGrader, predictorCorrector,
 *   format: 'markdown' | 'html' | 'json',
 * })
 *
 * Each of the four sensor inputs is optional. Only sections whose
 * inputs are present are emitted. An executive summary is always
 * produced, with overall-health aggregation across provided sensors.
 */

const {
  executiveSummary,
  contextInspectorSection,
  retrievalAuditorSection,
  toolCallGraderSection,
  predictorCorrectorSection,
  appendix,
} = require('./sections');

function deriveOverallSignals(inputs, { date }) {
  const healths = [];
  const allPathologies = [];

  for (const [source, inp] of Object.entries(inputs)) {
    if (!inp) continue;
    if (typeof inp.health === 'number') healths.push(inp.health);
    if (Array.isArray(inp.pathologies)) {
      for (const p of inp.pathologies) {
        allPathologies.push({ ...p, source });
      }
    }
  }

  const overallHealth = healths.length > 0
    ? Math.min(...healths)   // worst-signal-dominates, conservative
    : 1;
  const overallRegime = regimeFrom(overallHealth);

  const topFindings = allPathologies
    .slice()
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 5);

  const recommendedActions = buildRecommendations(topFindings, inputs);

  return {
    auditDate: date,
    overallHealth,
    overallRegime,
    totalPathologies: allPathologies.length,
    topFindings,
    recommendedActions,
  };
}

function regimeFrom(h) {
  if (h >= 0.85) return 'healthy';
  if (h >= 0.60) return 'drift';
  if (h >= 0.30) return 'contamination';
  return 'rot';
}

function buildRecommendations(topFindings, inputs) {
  const recs = new Set();
  for (const f of topFindings) {
    const rec = RECOMMENDATION_MAP[f.kind];
    if (rec) recs.add(rec);
  }
  if (recs.size === 0 && topFindings.length === 0) {
    recs.add('No pathologies detected. Continue monitoring on the current cadence.');
  }
  return [...recs];
}

const RECOMMENDATION_MAP = {
  // retrieval
  OFF_TOPIC:            'Audit retrieval index; consider reindexing with refreshed embeddings.',
  OUT_OF_DISTRIBUTION:  'Add a fallback path for queries outside corpus coverage — reject or escalate.',
  REDUNDANT:            'Deduplicate retrieval results before passing to the LLM.',
  RANK_INVERSION:       'Validate retriever scoring function against labelled eval set.',
  SCORE_MISCALIBRATED:  'Recalibrate retriever scoring or apply a reranker.',
  BIMODAL:              'Investigate index contamination or corpus partitioning issues.',
  LONG_TAIL:            'Reduce K or improve second-rank retrieval quality.',
  // tool-call
  SILENT_FAILURE:       'Enforce explicit error propagation from tools to the orchestrator.',
  TOOL_FIXATION:        'Audit agent prompts for tool-selection heuristics; may indicate over-trained behaviour.',
  RESPONSE_BLOAT:       'Truncate or summarise tool responses before appending to context.',
  SCHEMA_DRIFT:         'Enforce schema validation on tool outputs; reject non-conforming responses.',
  IRRELEVANT_RESPONSES: 'Review tool implementations — outputs not matching inputs.',
  CASCADING_FAILURES:   'Add circuit-breaker on repeated failures; halt agent session and escalate.',
};

function generateReport(opts = {}) {
  const {
    title  = 'Bell Tuning Audit Report',
    client = '(unspecified)',
    auditor = 'contrarianAI',
    date = new Date().toISOString().slice(0, 10),
    contextInspector, retrievalAuditor, toolCallGrader, predictorCorrector,
    format = 'markdown',
  } = opts;

  const inputs = { contextInspector, retrievalAuditor, toolCallGrader, predictorCorrector };
  const signals = deriveOverallSignals(inputs, { date });

  if (format === 'json') {
    return JSON.stringify({ title, client, auditor, date, signals, inputs }, null, 2);
  }

  const md = [];
  md.push(`# ${title}\n`);
  md.push(`**Client:** ${client}  `);
  md.push(`**Prepared by:** ${auditor}  `);
  md.push(`**Date:** ${date}\n`);
  md.push('---\n');
  md.push(executiveSummary({ inputs, signals }));
  md.push(contextInspectorSection(contextInspector));
  md.push(retrievalAuditorSection(retrievalAuditor));
  md.push(toolCallGraderSection(toolCallGrader));
  md.push(predictorCorrectorSection(predictorCorrector));
  md.push(appendix(inputs));

  const markdown = md.filter(Boolean).join('\n');
  if (format === 'html')     return markdownToHtml(markdown, title);
  if (format === 'markdown') return markdown;
  throw new Error(`Unknown format: ${format}`);
}

/**
 * Minimal markdown → HTML renderer. Not a full CommonMark implementation;
 * handles the subset this generator emits: headers, tables, lists, code
 * fences, bold, emphasis, and horizontal rules.
 */
function markdownToHtml(md, title) {
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    const [header, , ...rows] = tableRows;
    const cells = s => s.split('|').slice(1, -1).map(c => c.trim());
    out.push('<table>');
    out.push('<thead><tr>' + cells(header).map(h => `<th>${escape(h)}</th>`).join('') + '</tr></thead>');
    out.push('<tbody>');
    for (const row of rows) {
      out.push('<tr>' + cells(row).map(c => `<td>${inlineMd(escape(c))}</td>`).join('') + '</tr>');
    }
    out.push('</tbody></table>');
    tableRows = [];
    inTable = false;
  }

  function inlineMd(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else        { out.push('<pre><code>');     inCode = true; }
      continue;
    }
    if (inCode) { out.push(escape(line)); continue; }
    if (line.startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }
    if (line.startsWith('# '))   { out.push(`<h1>${inlineMd(escape(line.slice(2)))}</h1>`); continue; }
    if (line.startsWith('## '))  { out.push(`<h2>${inlineMd(escape(line.slice(3)))}</h2>`); continue; }
    if (line.startsWith('### ')) { out.push(`<h3>${inlineMd(escape(line.slice(4)))}</h3>`); continue; }
    if (line.startsWith('---'))  { out.push('<hr/>'); continue; }
    if (line.match(/^\d+\.\s/))  { out.push(`<p>${inlineMd(escape(line))}</p>`); continue; }
    if (line.startsWith('- '))   { out.push(`<p>• ${inlineMd(escape(line.slice(2)))}</p>`); continue; }
    if (line.trim() === '')      { out.push('<br/>'); continue; }
    out.push(`<p>${inlineMd(escape(line))}</p>`);
  }
  flushTable();

  const css = `
    body { font-family: system-ui, sans-serif; max-width: 920px; margin: 2em auto; padding: 0 1em; color: #222; line-height: 1.55; }
    table { border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 0.4em 0.9em; }
    th { background: #f4f4f4; text-align: left; }
    pre { background: #f6f6f6; padding: 0.8em; overflow-x: auto; border-left: 3px solid #888; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.2em; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 0.2em; margin-top: 2em; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  `;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(title)}</title><style>${css}</style></head>
<body>${out.join('\n')}</body></html>`;
}

module.exports = { generateReport };
