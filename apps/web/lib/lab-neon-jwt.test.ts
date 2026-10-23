import { afterEach,describe,expect,it,vi } from "vitest";
import { generateKeyPairSync,sign } from "node:crypto";
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
 it("accepts a properly signed, unexpired token with pinned issuer and audience",async()=>{
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const jwk=publicKey.export({format:"jwk"});
  process.env.LOOKOUT_MULTIUSER_LAB="enabled";
  process.env.LOOKOUT_LAB_JWT_ISSUER="https://auth.example.test";
  process.env.LOOKOUT_LAB_JWKS_URL="https://auth.example.test/jwks";
  process.env.LOOKOUT_LAB_JWT_AUDIENCE="lookout-lab";
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({keys:[{...jwk,kid:"test-key",alg:"RS256",use:"sig"}]}),{status:200})));
  const h=Buffer.from(JSON.stringify({alg:"RS256",kid:"test-key"})).toString("base64url");
  const p=Buffer.from(JSON.stringify({iss:process.env.LOOKOUT_LAB_JWT_ISSUER,sub:"user-a",aud:"lookout-lab",exp:Math.floor(Date.now()/1000)+60})).toString("base64url");
  const signature=sign("RSA-SHA256",Buffer.from(h+"."+p),privateKey).toString("base64url");
  expect(await verifyLabBearer(req("Bearer "+h+"."+p+"."+signature))).toEqual({issuer:"https://auth.example.test",subject:"user-a",authenticated:true});
  expect(await verifyLabBearer(req("Bearer "+h+"."+p+"."+signature.slice(0,-2)+"AA"))).toBeNull();
 });
 it("denies a JWKS URL on another host",async()=>{
  process.env.LOOKOUT_MULTIUSER_LAB="enabled";process.env.LOOKOUT_LAB_JWT_ISSUER="https://auth.example.test";
  process.env.LOOKOUT_LAB_JWKS_URL="https://evil.example.test/jwks";process.env.LOOKOUT_LAB_JWT_AUDIENCE="lookout-lab";
  expect(await verifyLabBearer(req())).toBeNull();
 });
});