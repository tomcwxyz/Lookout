import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@lookout/db", "@lookout/core"],
  output: "standalone"
};
export default config;
