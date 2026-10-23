import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/** Organisation-specific additions to the existing Lookout portfolio, not a second schema.
 * Both the project and its grant must commit together.
 */
export async function createAccountProject(organisationId:number,name:string,description?:string) {
 if (!Number.isSafeInteger(organisationId)||organisationId<1||!name.trim()||name.length>120||(description?.length??0)>2000)
   throw new Error("Invalid project details");
 return getDatabase().transaction(async tx=>{
  const project=await tx.execute(sql`INSERT INTO portfolio_projects(name,description)
   VALUES(${name.trim()},${description?.trim()||null}) RETURNING id`);
  const id=Number(project[0].id);
  await tx.execute(sql`INSERT INTO lookout_project_access(organisation_id,portfolio_project_id)
    VALUES(${organisationId},${id})`);
  return id;
 });
}

export async function confirmAccountProjectStatus(organisationId:number,id:number,status:string|null,note:string) {
 if (![organisationId,id].every(value=>Number.isSafeInteger(value)&&value>0) ||note.length>2000)
   throw new Error("Invalid project status");
 const rows=await getDatabase().execute(sql`
  UPDATE portfolio_projects p SET status=${status},status_note=${note.trim()||null},
    status_confirmed_at=CASE WHEN ${status}::text IS NOT NULL THEN NOW() ELSE NULL END,
    updated_at=NOW()
  WHERE p.id=${id} AND EXISTS (
    SELECT 1 FROM lookout_project_access a
    WHERE a.portfolio_project_id=p.id AND a.organisation_id=${organisationId}
  ) RETURNING p.id
 `);
 return rows.length>0;
}
