/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@buildworth/shared",
    "@buildworth/scoring",
    "@buildworth/config",
    "@buildworth/validation",
    "@buildworth/observability",
    "@buildworth/database",
    "@buildworth/ui"
  ],
};

export default nextConfig;
