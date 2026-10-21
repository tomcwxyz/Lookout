import {test} from "node:test";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import assert from "node:assert/strict";
const bin=process.env.LOOKOUT_MCP_BIN??resolve(dirname(fileURLToPath(import.meta.url)),"../bin/lookout-mcp.mjs");
test("standalone MCP starts without the monorepo database",async()=>{
 const child=spawn(process.execPath,[bin],{
  env:{...process.env,LOOKOUT_API_URL:"https://example.org",LOOKOUT_API_TOKEN:"smoke-test-only"},
  stdio:["pipe","pipe","pipe"]
 });
 let stderr="";
 child.stderr.on("data",part=>{stderr+=String(part);});
 try {
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(resolve,1000);
   child.once("exit",code=>{clearTimeout(timer);reject(new Error("MCP exited early: "+code+" "+stderr));});
   child.once("error",err=>{clearTimeout(timer);reject(err);});
  });
  assert.equal(child.exitCode,null,stderr);
 } finally {child.kill();}
});
