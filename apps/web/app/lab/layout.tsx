import {notFound} from "next/navigation";
import type {ReactNode} from "react";
export const dynamic="force-dynamic";
export default function LabLayout({children}:{children:ReactNode}){
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")notFound();
 return <>{children}</>;
}
