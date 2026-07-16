import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // vinext classifies multipart POSTs as progressive server actions before
    // dispatching App Router route handlers. Allow the documented 25 MB audio
    // upload plus multipart framing; application routes still enforce 25 MB.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
