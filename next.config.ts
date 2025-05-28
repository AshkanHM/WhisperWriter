
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
    // Fix: Prevent 'async_hooks' module from being bundled on the client
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'async_hooks': false,
      };
    }

    // Workaround for https://github.com/firebase/genkit/issues/1190
    // Ensure that the `node:crypto` module is aliased to `crypto-browserify`
    // and `node:stream` to `stream-browserify` for the client-side bundle.
    // This helps resolve issues with dependencies that might rely on these Node.js built-ins.
    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            "node:crypto": require.resolve("crypto-browserify"),
            "node:stream": require.resolve("stream-browserify"),
        };

        config.plugins.push(
            new webpack.ProvidePlugin({
                process: "process/browser",
                Buffer: ["buffer", "Buffer"],
            })
        );
    }
    
    return config;
  },
};

export default nextConfig;
