import { afterEach,describe,expect,it,vi } from "vitest";
import { verifyLabBearer } from "./lab-neon-jwt";
afterEach(()=>{delete process.env.LOOKOUT_MULTIUSER_LAB;delete process.env.LOOKOUT_LAB_JWT_ISSUER;delete process.env.LOOKOUT_LAB_JWKS_URL;delete process.env.LOOKOUT_LAB_JWT_AUDIENCE;vi.unstubAllGlobals();});
const req=(authorization?:string)=>new Request("https://example.test/api/lab/workspace",{headers:authorization?{authorization}:{}});
describe("isolated Neon JWT lab verifier",()=>{
 it("denies all credentials without explicit lab configuration",async()=>expect(await verifyLabBearer(req("Bearer forged.token.signature"))).toBeNull());
 it("rejects unsigned JWTs and never fetches keys",async()=>{
  process.env.LOOKOUT_MULTIUSER_LAB="enabled";process.env.LOOKOUT_LAB_JWT_ISSUER="https://auth.example.test";
  process.env.LOOKOUT_LAB_JWKS_URL="https://auth.example.test/jwks";process.env.LOOKOUT_LAB_JWT_AUDIENCE="lookout-lab";
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
  expect(await verifyLabBearer(req("Bearer "+Buffer.from(JSON.stringify({alg:"none"})).toString("base64url")+"."+Buffer.from(JSON.stringify({iss:"https://auth.example.test",sub:"victim"})).toString("base64url")+".bogus"))).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
 });
 it("denies a JWKS URL on another host",async()=>{
  process.env.LOOKOUT_MULTIUSER_LAB="enabled";process.env.LOOKOUT_LAB_JWT_ISSUER="https://auth.example.test";
  process.env.LOOKOUT_LAB_JWKS_URL="https://evil.example.test/jwks";process.env.LOOKOUT_LAB_JWT_AUDIENCE="lookout-lab";
  expect(await verifyLabBearer(req())).toBeNull();
 });
});