import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map(path => ({ path }));
}

/** Authentication uses the existing Neon Auth flow; the surrounding UI is Lookout. */
export default async function LookoutAuthPage({ params }: {
  params: Promise<{ path: string }>;
}) {
  if (process.env.LOOKOUT_MULTIUSER_LAB !== "enabled") notFound();
  const { path } = await params;

  return (
    <main className="lookout-auth-shell">
      <section className="lookout-auth-story" aria-label="About Lookout">
        <Link href="/auth/sign-in" className="lookout-auth-brand" aria-label="Lookout sign in">
          <span className="lookout-auth-brand-icon" aria-hidden="true">◉</span>
          <span>lookout<span className="brand-dot">.</span></span>
        </Link>

        <div className="lookout-auth-intro">
          <span className="lookout-auth-eyebrow">YOUR DEVELOPMENT PORTFOLIO</span>
          <h1>Know what needs <em>attention.</em></h1>
          <p>See your projects, understand what changed, and pick up where you left off.</p>
          <div className="lookout-auth-radar" aria-hidden="true">
            <span className="lookout-auth-ring lookout-auth-ring-one" />
            <span className="lookout-auth-ring lookout-auth-ring-two" />
            <span className="lookout-auth-ring lookout-auth-ring-three" />
            <span className="lookout-auth-centre" />
          </div>
        </div>

        <p className="lookout-auth-story-footer">
          <span className="pulse-dot" aria-hidden="true" /> Evidence first. Suggestions, not assumptions.
        </p>
      </section>

      <section className="lookout-auth-access" aria-label="Account access">
        <div className="lookout-auth-access-inner">
          <div className="lookout-auth-mobile-brand" aria-hidden="true">
            <span className="lookout-auth-brand-icon">◉</span> lookout<span className="brand-dot">.</span>
          </div>
          <span className="lookout-auth-access-eyebrow">LOOKOUT / ACCOUNT ACCESS</span>
          <div className="lookout-auth-form">
            <AuthView path={path} />
          </div>
          <p className="lookout-auth-access-footer">
            One Lookout. Your own projects and organisation.
          </p>
        </div>
      </section>
    </main>
  );
}
