import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lookout — know where everything stands",
  description: "An agent-led overview of everything you're building."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
