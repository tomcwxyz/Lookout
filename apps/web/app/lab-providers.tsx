"use client";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import {useRouter} from "next/navigation";
import Link from "next/link";
import type {ReactNode} from "react";
import {authClient} from "../lib/auth/lab-client";
export function LabProviders({children}:{children:ReactNode}){
 const router=useRouter();
 return <NeonAuthUIProvider authClient={authClient} navigate={router.push} replace={router.replace}
   onSessionChange={()=>router.refresh()} redirectTo="/lab" Link={Link}>
    {children}
   </NeonAuthUIProvider>;
}
