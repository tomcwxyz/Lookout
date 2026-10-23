import type { Metadata } from "next";
import "./globals.css";
import "@neondatabase/auth-ui/css";
import { LabProviders } from "./lab-providers";

export const metadata: Metadata = {
  title: "Lookout — know where everything stands",
  description: "An agent-led overview of everything you're building."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{process.env.LOOKOUT_MULTIUSER_LAB==="enabled" ? <LabProviders>{children}</LabProviders> : children}</body></html>;
}
