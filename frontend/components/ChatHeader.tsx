"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

interface ChatHeaderProps {
  isConnected: boolean;
  onConnect?: () => void;
}

const getNetworkInfo = (chainId: number | undefined) => {
  if (!chainId) return null;
  switch (chainId) {
    case hardhat.id:
      return { name: "Hardhat", color: "bg-yellow-500", textColor: "text-yellow-600" };
    case sepolia.id:
      return { name: "Sepolia", color: "bg-purple-500", textColor: "text-purple-600" };
    default:
      return { name: "Unknown", color: "bg-gray-500", textColor: "text-gray-600" };
  }
};

export const ChatHeader = ({ isConnected, onConnect: _onConnect }: ChatHeaderProps) => {
  const chainId = useChainId();
  const networkInfo = isConnected ? getNetworkInfo(chainId) : null;

  void _onConnect;
  return (
    <header className="border-b border-border/50 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              NeonCrypt
            </h1>
            <p className="text-xs text-gray-500">🔒 FHE Encrypted Messaging</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && networkInfo && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
              <span className={`w-2 h-2 rounded-full ${networkInfo.color}`} />
              <span className={`text-xs font-medium ${networkInfo.textColor}`}>
                {networkInfo.name}
              </span>
            </div>
          )}
          <div className="shadow-sm hover:shadow-md transition-all rounded-lg">
            <ConnectButton
              label="Connect Wallet"
              accountStatus="avatar"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

