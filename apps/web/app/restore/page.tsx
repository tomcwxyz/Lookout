import Link from "next/link";
import { redirect } from "next/navigation";
import { getLegacyPortfolioClaim } from "@lookout/db";
import { getLookoutContext } from "../../lib/auth/lookout-context";
import { restoreExistingPortfolio } from "./actions";
import { legacyRecoveryConfigured } from "../../lib/auth/legacy-password";

export const dynamic = "force-dynamic";

const messages: Record<string,string> = {
  credential: "That is not the previous Lookout admin password. Your portfolio has not been changed.",
  claimed: "This original portfolio has already been restored to a workspace.",
  review: "Some portfolio projects are already assigned. Recovery needs a manual review to protect other workspaces.",
  permissions: "Only an organisation owner can restore the previous portfolio."
};

export default async function RestorePortfolioPage({
  searchParams
}: {searchParams: Promise<{error?:string}>}) {
  const context = await getLookoutContext();
  if (context.mode !== "account") redirect("/lab");
  const {error} = await searchParams;
  const claimedBy = await getLegacyPortfolioClaim();
  const isOwner = context.role === "owner";
  const isRestoredHere = claimedBy === context.organisationId;
  const canRestore = isOwner && claimedBy === null && legacyRecoveryConfigured(process.env.LOOKOUT_DASHBOARD_TOKEN);

  return <main className="detail-layout" style={{maxWidth:760,margin:"3rem auto",padding:"0 20px"}}>
    <Link href="/" className="back-link">← Back to Lookout</Link>
    <header className="detail-header">
      <div><span className="eyebrow">LOOKOUT / ACCOUNT RECOVERY</span>
        <h1>Restore your existing portfolio</h1>
        <p>Connect the projects and observations from Lookout's original single-owner dashboard
        to your current organisation, {context.name}.</p></div>
    </header>
    {error && messages[error] && <section className="notice" role="alert">
      <strong>Recovery not completed</strong><p>{messages[error]}</p>
    </section>}
    {isRestoredHere ? <section className="panel" style={{padding:24}}>
      <h2>Portfolio restored</h2>
      <p>Your organisation already owns the original Lookout portfolio. Your projects and existing evidence remain intact.</p>
      <Link className="back-link" href="/">View your projects →</Link>
    </section> : canRestore ? <section className="panel" style={{padding:24}}>
      <h2>Prove ownership of the previous Lookout</h2>
      <p>Enter the admin password you used before Lookout introduced individual accounts.
      You only need to do this once. The password is checked securely and never stored again.</p>
      <form action={restoreExistingPortfolio} style={{display:"grid",gap:14,maxWidth:480}}>
        <label>Previous Lookout admin password
          <input name="previousAdminPassword" type="password" autoComplete="off" required minLength={1}
            aria-label="Previous Lookout admin password" />
        </label>
        <button type="submit">Restore my existing projects</button>
      </form>
      <p className="work-caution">This attaches the historical portfolio to your organisation.
        It does not give another organisation access, and it does not alter the original evidence.</p>
    </section> : <section className="panel" style={{padding:24}}>
      <h2>Portfolio recovery unavailable</h2>
      <p>{claimedBy !== null
        ? "The previous portfolio is already assigned to an organisation. It cannot be claimed again."
        : isOwner ? "The old admin credential is not configured. Recovery requires an administrator."
          : "Only the owner of this organisation can restore the original portfolio."}</p>
    </section>}
  </main>;
}
