"use server";
import {revalidatePath} from "next/cache";
import {issueOrganisationMcpReadToken,revokeOrganisationMcpConnection} from "@lookout/db";
import {getLookoutContext} from "../../lib/auth/lookout-context";
import {getLabIdentity} from "../../lib/auth/lab-server";

export type McpKeyResult={token:string|null;expiresAt:string|null;error:string|null};
const verify=async()=>{
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")throw new Error("Organisation connections are unavailable");
 const [account,identity]=await Promise.all([getLookoutContext(),getLabIdentity()]);
 if(account.mode!=="account"||!identity?.authenticated||!["owner","admin"].includes(account.role))
  throw new Error("Only organisation owners and admins can manage connections");
 return {issuer:identity.issuer,subject:identity.subject,organisationId:account.organisationId};
};
export async function createReadOnlyConnection(_previous:McpKeyResult,form:FormData):Promise<McpKeyResult>{
 try{
  const member=await verify();
  const name=form.get("name");
  if(typeof name!=="string"||name.trim().length<3||name.length>80)
    return {token:null,expiresAt:null,error:"Give this connection a name of 3–80 characters."};
  const result=await issueOrganisationMcpReadToken({...member,label:name});
  revalidatePath("/connections");
  return {token:result.token,expiresAt:result.expiresAt,error:null};
 }catch(error){
  return {token:null,expiresAt:null,error:error instanceof Error?error.message:"Could not create connection"};
 }
}
export async function revokeReadOnlyConnection(form:FormData):Promise<void>{
 const member=await verify();
 const raw=form.get("connectionId");
 if(typeof raw!=="string"||!/^[1-9][0-9]{0,12}$/.test(raw))throw new Error("Invalid connection");
 await revokeOrganisationMcpConnection({...member,connectionId:Number(raw)});
 revalidatePath("/connections");
}
