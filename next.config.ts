import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },

  webpack: (config, { isServer, webpack }) => {
    // Client-only polyfills you already needed
    if (!isServer) {
      (config.resolve.alias as any) = {
        ...(config.resolve.alias || {}),
        async_hooks: false,
      };

      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        'node:crypto': require.resolve('crypto-browserify'),
        'node:stream': require.resolve('stream-browserify'),
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    return config;
  },
};

export default nextConfig;
