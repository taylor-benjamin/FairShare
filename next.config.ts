import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
};

export default nextConfig;

// Lets `next dev` use the local D1 database and .dev.vars through getCloudflareContext().
initOpenNextCloudflareForDev();
