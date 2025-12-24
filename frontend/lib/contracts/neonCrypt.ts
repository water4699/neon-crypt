import { Address } from "viem";
import { sepolia, hardhat } from "wagmi/chains";

export const NEON_CRYPT_ADDRESSES: Record<number, Address> = {
  [sepolia.id]: "0x0000000000000000000000000000000000000000", // Will be updated after deployment
  [hardhat.id]: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Default first deployment address
};

export const NEON_CRYPT_ABI = [
  {
    type: "function",
    name: "submitMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedContent", type: "bytes32", internalType: "externalEuint32" },
      { name: "inputProof", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMessageCount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMessage",
    stateMutability: "view",
    inputs: [{ name: "messageId", type: "uint256" }],
    outputs: [
      { name: "encryptedContent", type: "bytes32", internalType: "euint32" },
      { name: "timestamp", type: "uint256" },
      { name: "sender", type: "address" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getUserMessages",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "messageIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getUserMessageMetadata",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "timestamps", type: "uint256[]" },
      { name: "messageIds", type: "uint256[]" },
      { name: "activeStatus", type: "bool[]" },
    ],
  },
  {
    type: "function",
    name: "getTotalMessages",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "total", type: "uint256" }],
  },
  {
    type: "function",
    name: "deleteMessage",
    stateMutability: "nonpayable",
    inputs: [{ name: "messageId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "MessageSubmitted",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "messageId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MessageDeleted",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "messageId", type: "uint256", indexed: true },
    ],
  },
] as const;

export function getNeonCryptAddress(chainId: number): Address {
  const addr = NEON_CRYPT_ADDRESSES[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error("NeonCrypt address not set for chain " + chainId);
  }
  return addr;
}

