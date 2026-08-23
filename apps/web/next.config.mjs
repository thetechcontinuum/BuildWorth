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
    "@buildworth/ui",
    "@buildworth/ai",
    "@buildworth/source-connectors",
    "@buildworth/opportunity-engine"
  ],
};

export default nextConfig;
