import { createNeonAuth } from "@neondatabase/auth/next/server";

export function getLabAuth(){
 const url=process.env.NEON_AUTH_BASE_URL;
 const secret=process.env.NEON_AUTH_COOKIE_SECRET;
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled" || !url?.startsWith("https://") ||
    !secret || secret.length<32) return null;
 return createNeonAuth({baseUrl:url,cookies:{secret,sessionDataTtl:60}});
}
export async function getLabIdentity(){
 const auth=getLabAuth();
 if(!auth)return null;
 try{
  const response=await auth.getSession();
  const user=response?.user;
  if(!user?.id || !user.email) return null;
  return {issuer:process.env.NEON_AUTH_BASE_URL!,subject:user.id,
          email:user.email,emailVerified:user.emailVerified===true,
          name:user.name??null,authenticated:true as const};
 }catch{return null;}
}
