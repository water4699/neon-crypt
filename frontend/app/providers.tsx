"use client";

import "@rainbow-me/rainbowkit/styles.css";
import type { ReactNode } from "react";
import { useState } from "react";

import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { hardhat, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 0 },
      mutations: { retry: 0 },
    },
  }));

  // Build readonly RPC map for FHEVM usage (avoid routing reads via wallet)
  const localUrl = process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545";
  // Prefer public Sepolia RPC that typically works in more regions.
  // Can be overridden via NEXT_PUBLIC_SEPOLIA_RPC_URL.
  const sepoliaUrl =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org";
  const readonlyRpcs: Record<number, string> = {
    // Only map Hardhat to direct JSON-RPC in browser to avoid MetaMask caching on dev
    // Do NOT map Sepolia here to prevent browser-side CORS issues; use wallet for reads instead
    31337: localUrl,
  };

  // Wagmi + RainbowKit
  // Important: Provide transports for the full union of possible chain ids
  // even if Sepolia is not included in `chains`, to satisfy Wagmi's typing.
  const transports = {
    [hardhat.id]: http(localUrl),
    [sepolia.id]: http(sepoliaUrl),
  } as const;

  // Always include Sepolia in chain list so RainbowKit modal shows both
  const chains = [hardhat, sepolia] as const;

  const wagmiConfig = createConfig({
    chains,
    connectors: [injected()],
    transports,
    ssr: true,
  });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <MetaMaskProvider>
            <MetaMaskEthersSignerProvider initialMockChains={readonlyRpcs}>
              <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
            </MetaMaskEthersSignerProvider>
          </MetaMaskProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
