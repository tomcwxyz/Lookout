import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";
import type { VerifiedIdentity } from "./verified-workspace";

type JwtHeader={alg?:string;kid?:string;typ?:string};
type JwtClaims={iss?:string;sub?:string;aud?:string|string[];exp?:number;nbf?:number};
const decode=(s:string)=>JSON.parse(Buffer.from(s,"base64url").toString("utf8")) as Record<string,unknown>;

/** Lab-only: independently verify a Neon Auth JWT. Issuer, audience and JWKS are deployment-pinned.
 * Never treat unverified payload data as an identity.
 */
export async function verifyLabBearer(request:Request):Promise<VerifiedIdentity|null>{
 const issuer=process.env.LOOKOUT_LAB_JWT_ISSUER;
 const jwksUrl=process.env.LOOKOUT_LAB_JWKS_URL;
 const audience=process.env.LOOKOUT_LAB_JWT_AUDIENCE;
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled" || !issuer || !jwksUrl || !audience)return null;
 let trusted:URL,keys:URL;
 try {trusted=new URL(issuer);keys=new URL(jwksUrl);}
 catch {return null;}
 if(trusted.protocol!=="https:"||keys.protocol!=="https:"||trusted.hostname!==keys.hostname)return null;
 const auth=request.headers.get("authorization")??"";
 if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth)||auth.length>8192)return null;
 try {
  const [h,p,s]=auth.slice(7).split(".");
  const header=decode(h) as JwtHeader;const claims=decode(p) as JwtClaims;
  if(header.alg!=="RS256" || !header.kid || !claims.sub || claims.sub.length>512 ||
     claims.iss!==issuer || !Number.isFinite(claims.exp) || claims.exp! *1000<=Date.now() ||
     (claims.nbf!==undefined&&claims.nbf*1000>Date.now()+30000) ||
     !(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience))return null;
  const response=await fetch(jwksUrl,{cache:"no-store",signal:AbortSignal.timeout(4000)});
  if(!response.ok||Number(response.headers.get("content-length")??0)>32768)return null;
  const body=await response.text();if(body.length>32768)return null;
  const jwks=JSON.parse(body) as {keys?: Array<JsonWebKey&{kid?:string;alg?:string;use?:string}>};
  const key=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&
    (!k.use||k.use==="sig")&&(!k.alg||k.alg==="RS256"));
  if(!key)return null;
  const publicKey=createPublicKey({key,format:"jwk"});
  if(!verifySignature("RSA-SHA256",Buffer.from(h+"."+p),publicKey,Buffer.from(s,"base64url")))return null;
  return {issuer,subject:claims.sub,authenticated:true};
 }catch{return null;}
}
