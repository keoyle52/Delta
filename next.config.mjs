import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@xyflow/react', '@privy-io/react-auth'],
  serverExternalPackages: ['utf-8-validate', 'bufferutil', '@privy-io/server-auth'],
  webpack: (config, { webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      viem: path.resolve('./node_modules/viem'),
      '@stripe/crypto': false,
      '@farcaster/mini-app-solana': false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@phosphor-icons\/webcomponents\/Ph(.+)$/,
        (resource) => {
          resource.request = '@phosphor-icons/react';
        }
      )
    );
    return config;
  },
};

export default nextConfig;
