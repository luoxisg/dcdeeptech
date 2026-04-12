/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@lead-intel/ui", "@lead-intel/types"],
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
