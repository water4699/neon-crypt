import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence monorepo root inference warning
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Bind to 0.0.0.0 for WSL access from Windows
  // This is handled via next dev -H 0.0.0.0 in package.json scripts
  headers() {
    // Required by FHEVM: apply to ALL routes, not only '/'
    // so that scripts/wasm/static assets are also served with COOP/COEP
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ]);
  },
  webpack: (config) => {
    // Shim RN-only storage required by @metamask/sdk via wagmi's MetaMask connector
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "stubs/asyncStorage.ts"
      ),
    };
    return config;
  },
};

export default nextConfig;
