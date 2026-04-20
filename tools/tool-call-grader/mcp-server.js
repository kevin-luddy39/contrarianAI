#!/usr/bin/env node
/**
 * tool-call-grader — MCP Server
 *
 * Exposes:
 *   grade_call     — grade a single tool call
 *   grade_session  — grade a full session of tool calls
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { gradeCall, gradeSession } = require('./core');

const server = new McpServer({ name: 'tool-call-grader', version: '0.1.0' });

const callSchema = z.object({
  tool: z.string(),
  args: z.any().optional(),
  response: z.any().optional(),
  error: z.any().optional(),
  agent: z.string().optional(),
  timestamp: z.number().optional(),
  latency_ms: z.number().optional(),
});

server.tool(
  'grade_call',
  'Grade a single tool call. Returns signals: succeeded, responseSize, isStructured, relevance, latency.',
  { call: callSchema },
  async ({ call }) => ({
    content: [{ type: 'text', text: JSON.stringify(gradeCall(call), null, 2) }],
  }),
);

server.tool(
  'grade_session',
  'Grade a full session of tool calls. Returns per-call signals, session-level aggregates, pathology flags, health, and regime label.',
  { calls: z.array(callSchema) },
  async ({ calls }) => ({
    content: [{ type: 'text', text: JSON.stringify(gradeSession({ calls }), null, 2) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(err => {
  process.stderr.write(`tool-call-grader MCP error: ${err.stack || err.message}\n`);
  process.exit(1);
});
