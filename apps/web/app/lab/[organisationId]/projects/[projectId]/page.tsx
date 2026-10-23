import { redirect } from "next/navigation";
/** Old lab links now use the original, tenant-authorised Lookout project page. */
export default async function PreviousLabProject({params}:{
 params:Promise<{organisationId:string;projectId:string}>
}) {
 const {projectId}=await params;
 redirect("/portfolio/"+encodeURIComponent(projectId));
}
