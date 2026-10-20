import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@lookout/db", "@lookout/core", "@lookout/connectors", "@lookout/agents", "@lookout/worker"],
  output: "standalone"
};
export default config;
