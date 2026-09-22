import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resumes arrive through a server action, which Next caps at 1 MB by default.
    // Files are held to 4 MB (lib/parse/limits.ts); this leaves room for the rest of the form.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
