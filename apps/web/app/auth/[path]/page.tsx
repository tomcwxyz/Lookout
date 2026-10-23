import {notFound} from "next/navigation";
import {AuthView} from "@neondatabase/auth-ui";
import {authViewPaths} from "@neondatabase/auth-ui/server";
export const dynamicParams=false;
export function generateStaticParams(){return Object.values(authViewPaths).map(path=>({path}));}
export default async function LabAuthPage({params}:{params:Promise<{path:string}>}){
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")notFound();
 const {path}=await params;
 return <main className="detail-layout" style={{maxWidth:560,margin:"5rem auto"}}>
  <h1>Welcome to Lookout</h1><p>Sign in to your own private workspace.</p>
  <AuthView path={path}/></main>;
}
