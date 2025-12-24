"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useReadContract,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { NEON_CRYPT_ABI, getNeonCryptAddress } from "@/lib/contracts/neonCrypt";
import { encryptUint32, decryptUint32, stringToUint32, uint32ToString, clearFhevmCache } from "@/lib/fhevm";

interface Message {
  id: string;
  messageId: number;
  sender: string;
  message: string;
  timestamp: string;
  isEncrypted: boolean;
  isOwn?: boolean;
  encryptedHandle?: bigint;
  isActive?: boolean;
}

export default function Home() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previousChainId, setPreviousChainId] = useState<number | undefined>(undefined);

  // Clear FHEVM cache when network changes
  useEffect(() => {
    if (chainId && previousChainId && chainId !== previousChainId) {
      console.log(`Network changed from ${previousChainId} to ${chainId}, clearing FHEVM cache`);
      clearFhevmCache();
      setMessages([]);
      toast.info("Network changed", {
        description: "FHEVM cache cleared for new network",
      });
    }
    setPreviousChainId(chainId);
  }, [chainId, previousChainId]);

  // Get contract address for current chain
  let contractAddress: `0x${string}` | undefined;
  try {
    contractAddress = chainId ? getNeonCryptAddress(chainId) : undefined;
  } catch {
    contractAddress = undefined;
  }

  const { data: userMessageIds, refetch: refetchMessages } = useReadContract({
    address: contractAddress,
    abi: NEON_CRYPT_ABI,
    functionName: "getUserMessages",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && contractAddress),
    },
  });

  useEffect(() => {
    if (!userMessageIds || !contractAddress || !address || !publicClient) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const typedMessageIds = userMessageIds as readonly bigint[];
        const loadedMessages: Message[] = [];

        for (const msgId of typedMessageIds) {
          const result = await publicClient.readContract({
            address: contractAddress,
            abi: NEON_CRYPT_ABI,
            functionName: "getMessage",
            args: [msgId],
          });
          const [encryptedContent, timestamp, sender, isActive] = result as unknown as [bigint, bigint, `0x${string}`, boolean];

          const isOwn = sender === address;
          const displaySender = isOwn ? "You" : `${sender.slice(0, 6)}...${sender.slice(-4)}`;

          loadedMessages.push({
            id: `msg-${msgId.toString()}`,
            messageId: Number(msgId),
            sender: displaySender,
            message: "Encrypted message",
            timestamp: new Date(Number(timestamp) * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isEncrypted: true,
            isOwn,
            encryptedHandle: encryptedContent,
            isActive,
          });
        }

        setMessages(loadedMessages);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadMessages();
  }, [userMessageIds, contractAddress, address, publicClient]);

  const handleConnect = () => {};

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetchMessages();
      toast.success("Messages refreshed");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh messages");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!walletClient || !address || !contractAddress) {
      toast.error("Wallet not connected");
      return;
    }

    // Get the EIP-1193 provider from window.ethereum
    const provider = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!provider) {
      toast.error("No wallet provider found");
      return;
    }

    try {
      toast.info("Encrypting message...");

      const messageValue = stringToUint32(message);
      const { handle, inputProof } = await encryptUint32(
        messageValue,
        provider as Parameters<typeof encryptUint32>[1],
        contractAddress,
        address
      );

      toast.info("Submitting to blockchain...");

      await writeContractAsync({
        address: contractAddress,
        abi: NEON_CRYPT_ABI,
        functionName: "submitMessage",
        args: [handle as `0x${string}`, inputProof as `0x${string}`],
      });

      toast.success("Message sent", {
        description: "Your encrypted message has been delivered",
      });

      await refetchMessages();
    } catch (error) {
      console.error("Send message error:", error);
      const description = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to send", {
        description,
      });
    }
  };

  const handleDecryptMessage = async (id: string) => {
    if (!walletClient || !address || !contractAddress) {
      toast.error("Wallet not connected");
      return;
    }

    // Get the EIP-1193 provider from window.ethereum
    const provider = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!provider) {
      toast.error("No wallet provider found");
      return;
    }

    try {
      const target = messages.find((m) => m.id === id);
      if (!target?.encryptedHandle) {
        throw new Error("No encrypted data");
      }

      toast.info("Decrypting message...");

      const decryptedValue = await decryptUint32(
        target.encryptedHandle,
        provider as Parameters<typeof decryptUint32>[1],
        contractAddress,
        address
      );

      const decryptedMessage = uint32ToString(decryptedValue);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, message: decryptedMessage, isEncrypted: false } : m
        )
      );

      toast.success("Message decrypted");
    } catch (error) {
      console.error("Decrypt error:", error);
      const description = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to decrypt", {
        description,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <ChatHeader isConnected={isConnected} onConnect={handleConnect} />

      <ScrollArea className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Message Count and Refresh */}
          {isConnected && contractAddress && (
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="font-medium">{messages.filter(m => m.isActive !== false).length} messages</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 shadow-sm"
                title="Refresh messages"
              >
                <svg
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          )}

          {/* Messages List */}
          <div className="space-y-3">
            {isLoading && (
              <div className="text-center text-gray-500 py-12">
                <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-2"></div>
                <p>Loading messages...</p>
              </div>
            )}
            {!isLoading && messages.length === 0 && isConnected && contractAddress && (
              <div className="text-center text-gray-500 py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-1">No messages yet</p>
                <p className="text-sm">Send your first encrypted message below</p>
              </div>
            )}
            {!isLoading && !isConnected && (
              <div className="text-center text-gray-500 py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-1">Connect your wallet</p>
                <p className="text-sm">Start sending encrypted messages</p>
              </div>
            )}
            {!isLoading && isConnected && !contractAddress && (
              <div className="text-center text-gray-500 py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-1">Contract not deployed</p>
                <p className="text-sm">Please switch to Hardhat or Sepolia network</p>
              </div>
            )}
            {messages
              .filter((m) => m.isActive !== false)
              .map((msg) => (
                <ChatMessage
                  key={msg.id}
                  {...msg}
                  onDecrypt={msg.isEncrypted ? () => handleDecryptMessage(msg.id) : undefined}
                  canDecrypt={Boolean(isConnected && walletClient)}
                />
              ))}
          </div>
        </div>
      </ScrollArea>

      <ChatInput onSend={handleSendMessage} disabled={!isConnected || !contractAddress} />
    </div>
  );
}
