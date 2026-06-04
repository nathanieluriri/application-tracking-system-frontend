import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // Server-only Node packages must not be bundled by webpack for route handlers
  // / RSC — they are required() at runtime. Avoids "Can't resolve 'stream' /
  // 'crypto' / kerberos / snappy ..." module-not-found errors from mongodb &
  // nodemailer (and keeps the stripe SDK external for its lazy import).
  serverExternalPackages: ["mongodb", "nodemailer", "stripe", "bcryptjs"],
};

export default nextConfig;
