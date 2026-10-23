import {redirect} from "next/navigation";
/** Previous lab URLs now select an organisation in the one Lookout app. */
export default async function LegacyWorkspaceRedirect({params}:{params:Promise<{organisationId:string}>}){
 const {organisationId}=await params;
 redirect("/workspace/"+encodeURIComponent(organisationId)+"/activate");
}
