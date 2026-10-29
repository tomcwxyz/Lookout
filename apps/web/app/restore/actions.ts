"use server";
import { redirect } from "next/navigation";
import { claimLegacyPortfolio } from "@lookout/db";
import { getLookoutContext } from "../../lib/auth/lookout-context";
import { getLabIdentity } from "../../lib/auth/lab-server";
import { validLegacyRecoveryPassword } from "../../lib/auth/legacy-password";

/** A one-time bridge between the retired owner password and a Neon Auth owner.
 * Neither the submitted password nor its digest is stored.
 */
export async function restoreExistingPortfolio(form: FormData) {
  const context = await getLookoutContext();
  if (context.mode !== "account" || context.role !== "owner") redirect("/");
  const identity = await getLabIdentity();
  if (!identity?.authenticated) redirect("/auth/sign-in");

  if (!validLegacyRecoveryPassword(form.get("previousAdminPassword"), process.env.LOOKOUT_DASHBOARD_TOKEN))
    redirect("/restore?error=credential");

  try {
    await claimLegacyPortfolio({
      issuer: identity.issuer, subject: identity.subject,
      organisationId: context.organisationId
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "Previous portfolio has already been claimed") redirect("/restore?error=claimed");
    if (reason === "Portfolio has existing organisation assignments") redirect("/restore?error=review");
    if (reason === "Organisation owner session required") redirect("/restore?error=permissions");
    throw error;
  }
  redirect("/");
}
