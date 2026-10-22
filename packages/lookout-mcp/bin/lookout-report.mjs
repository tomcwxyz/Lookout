#!/usr/bin/env node
import { readFile } from "node:fs/promises";

function usage() {
  console.error("Usage: lookout-report <checkpoint.json | -> [--kind progress|evidence|blocker|handover|next_action]");
  process.exitCode = 2;
}
const args = process.argv.slice(2);
if (!args[0] || args.length > 3 || (args.length > 1 && args[1] !== "--kind") || args.length === 3 && !args[2]) {
  usage();
} else {
  try {
    const api = process.env.LOOKOUT_API_URL?.replace(/\\/+$/, "");
    const token = process.env.LOOKOUT_API_TOKEN;
    if (!api || !token) throw new Error("LOOKOUT_API_URL and LOOKOUT_API_TOKEN are required");
    const url = new URL(api);
    if (url.protocol !== "https:" &&
      !(process.env.LOOKOUT_ALLOW_LOCAL_HTTP === "true" && ["localhost","127.0.0.1"].includes(url.hostname)))
      throw new Error("Lookout API requires HTTPS");
    const { stdin } = process;
    const raw = args[0] === "-"
      ? await new Promise((resolve, reject) => {
          let text = "";
          stdin.setEncoding("utf8");
          stdin.on("data", chunk => {
            text += chunk;
            if (Buffer.byteLength(text, "utf8") > 30000) reject(new Error("Report too large"));
          });
          stdin.on("end", () => resolve(text));
          stdin.on("error", reject);
        })
      : await readFile(args[0], "utf8");
    if (Buffer.byteLength(raw, "utf8") > 30000) throw new Error("Report too large");
    const data = JSON.parse(raw);
    const kind = args[2] ?? data.kind ?? "handover";
    const checkpoint = data.checkpoint ?? data;
    const response = await fetch(api + "/api/agent/contributions", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json",
        Accept: "application/json" },
      body: JSON.stringify({ kind, checkpoint }),
      signal: AbortSignal.timeout(30000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Lookout rejected contribution (HTTP " + response.status + "): " +
      (typeof result.error === "string" ? result.error : "Unknown error"));
    process.stdout.write(JSON.stringify(result) + "\\n");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Report failed");
    process.exitCode = 1;
  }
}
