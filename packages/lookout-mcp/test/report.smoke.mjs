import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const bin = process.env.LOOKOUT_REPORT_BIN ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../bin/lookout-report.mjs");
test("CLI submits an attributed handover to the scoped contribution endpoint", async () => {
  const received = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: 11, trust: "agent_reported" }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const dir = await mkdtemp(join(tmpdir(), "lookout-report-"));
  try {
    const checkpoint = {
      version: 1, eventId: "relay:field:001", agent: "Test", title: "Handover",
      objective: "Test CLI", summary: "Claimed tests passed", implemented: [],
      remaining: ["Human acceptance"], tests: [], decisions: [], blockers: []
    };
    const file = join(dir, "report.json");
    await writeFile(file, JSON.stringify(checkpoint));
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bin, file, "--kind", "handover"], {
        env: { ...process.env, LOOKOUT_API_URL: "http://127.0.0.1:" + port,
          LOOKOUT_API_TOKEN: "test-token", LOOKOUT_ALLOW_LOCAL_HTTP: "true" }
      });
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => stdout += chunk);
      child.stderr.on("data", chunk => stderr += chunk);
      child.once("error", reject);
      child.once("close", code => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).trust, "agent_reported");
    assert.equal(received[0].url, "/api/agent/contributions");
    assert.equal(received[0].auth, "Bearer test-token");
    assert.equal(received[0].body.kind, "handover");
    assert.equal(received[0].body.checkpoint.eventId, "relay:field:001");
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
