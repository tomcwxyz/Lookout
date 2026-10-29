"use server";
import {redirect} from "next/navigation";
import {onboardVerifiedIdentity} from "@lookout/db";
import {getLabIdentity} from "../../lib/auth/lab-server";
export async function createLabOrganisation(form:FormData){
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")throw new Error("Not available");
 const identity=await getLabIdentity();
 // Lab accepts a signed-in identity without requiring email verification.
 // Authentication is still established server-side via Neon Auth session cookies.
 if(!identity)throw new Error("Sign in before creating a workspace");
 const name=form.get("name"),slug=form.get("slug");
 if(typeof name!=="string"||typeof slug!=="string")redirect("/lab?error=invalid");
 const organisationName=name.trim();
 const organisationSlug=slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
 if(organisationName.length<2||organisationName.length>100||organisationSlug.length<3||organisationSlug.length>50)redirect("/lab?error=invalid");
 let organisation;
 try {
  organisation=await onboardVerifiedIdentity({issuer:identity.issuer,subject:identity.subject,
   verifiedEmail:identity.email,organisationName,organisationSlug});
 } catch(error) {
  const message=error instanceof Error ? error.message : "";
  if(message==="Invalid onboarding details") redirect("/lab?error=invalid");
  if(message==="Organisation slug unavailable") redirect("/lab?error=slug");
  if(message==="Identity already onboarded") redirect("/lab");
  if(message.startsWith("Email already linked")) redirect("/lab?error=linked");
  throw error;
 }
 redirect("/workspace/"+organisation.organisationId+"/activate");
}
export async function signOutLab(){
 const {getLabAuth}=await import("../../lib/auth/lab-server");
 const auth=getLabAuth();if(!auth)throw new Error("Not available");
 await auth.signOut();redirect("/auth/sign-in");
}
