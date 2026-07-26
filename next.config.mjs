/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@xyflow/react'],
  serverExternalPackages: ['utf-8-validate', 'bufferutil'],
};

export default nextConfig;
