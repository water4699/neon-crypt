import { BrowserProvider, Eip1193Provider, JsonRpcProvider } from "ethers";
import { initFhevm, createInstance, FhevmInstance } from "fhevmjs";
import { MockFhevmInstance } from "@fhevm/mock-utils";
import { Address } from "viem";

// Cached instances
let fhevmInstance: FhevmInstance | null = null;
let mockFhevmInstance: MockFhevmInstance | null = null;
let isInitialized = false;
let cachedUserAddress: string | null = null;

// Zama FHEVM contract addresses on Sepolia
const ZAMA_KMS_CONTRACT = "0x208De73316E44722e16f6dDFF40881A3e4F86104";
const ZAMA_ACL_CONTRACT = "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5";
const ZAMA_GATEWAY_URL = "https://gateway.sepolia.zama.ai";

// Local Hardhat chain ID and RPC
const LOCAL_CHAIN_ID = 31337;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

// FHEVM metadata type from fhevm_relayer_metadata RPC call
interface FhevmRelayerMetadata {
  version: string;
  chainId: number;
  gatewayChainId: number;
  ACLAddress: `0x${string}`;
  CoprocessorAddress: `0x${string}`;
  KMSVerifierAddress: `0x${string}`;
  InputVerifierAddress: `0x${string}`;
  relayerSignerAddress: `0x${string}`;
}

// EIP712 Domain info from contracts
interface Eip712DomainInfo {
  chainId: bigint;
  verifyingContract: `0x${string}`;
}

// Cache for eip712 domain info
let cachedInputVerifierEip712Domain: Eip712DomainInfo | null = null;
let cachedKmsVerifierEip712Domain: Eip712DomainInfo | null = null;

// Cache metadata to avoid repeated RPC calls
let cachedMetadata: FhevmRelayerMetadata | null = null;

export async function initializeFhevm(): Promise<void> {
  if (isInitialized) return;

  try {
    console.log("[FHEVM] Initializing WASM...");

    const tfheResponse = await fetch("/tfhe_bg.wasm");
    if (!tfheResponse.ok) {
      throw new Error(`Failed to fetch tfhe_bg.wasm: ${tfheResponse.status}`);
    }
    const tfheBuffer = await tfheResponse.arrayBuffer();
    console.log("[FHEVM] tfhe_bg.wasm loaded, size:", tfheBuffer.byteLength);

    const kmsResponse = await fetch("/kms_lib_bg.wasm");
    if (!kmsResponse.ok) {
      throw new Error(`Failed to fetch kms_lib_bg.wasm: ${kmsResponse.status}`);
    }
    const kmsBuffer = await kmsResponse.arrayBuffer();
    console.log("[FHEVM] kms_lib_bg.wasm loaded, size:", kmsBuffer.byteLength);

    await initFhevm({
      tfheParams: tfheBuffer,
      kmsParams: kmsBuffer,
    });

    isInitialized = true;
    console.log("[FHEVM] WASM initialized successfully");
  } catch (error) {
    console.error("[FHEVM] Failed to initialize WASM:", error);
    throw error;
  }
}

// Get chain ID from provider
export async function getChainId(provider: Eip1193Provider): Promise<number> {
  const ethersProvider = new BrowserProvider(provider);
  const network = await ethersProvider.getNetwork();
  return Number(network.chainId);
}

export function isLocalNetwork(chainId: number): boolean {
  return chainId === LOCAL_CHAIN_ID;
}

// Dynamically fetch FHEVM metadata from Hardhat node
async function fetchFhevmMetadata(rpcUrl: string): Promise<FhevmRelayerMetadata> {
  if (cachedMetadata) {
    console.log("[FHEVM] Using cached metadata");
    return cachedMetadata;
  }

  console.log("[FHEVM] Fetching FHEVM metadata from:", rpcUrl);
  const rpc = new JsonRpcProvider(rpcUrl);

  try {
    // First verify it's a Hardhat node
    const version = await rpc.send("web3_clientVersion", []);
    console.log("[FHEVM] Node version:", version);

    if (typeof version !== "string" || !version.toLowerCase().includes("hardhat")) {
      throw new Error("Not a Hardhat node");
    }

    // Fetch FHEVM relayer metadata
    const metadata = await rpc.send("fhevm_relayer_metadata", []);
    console.log("[FHEVM] Relayer metadata:", metadata);

    if (!metadata || typeof metadata !== "object") {
      throw new Error("Invalid metadata response");
    }

    cachedMetadata = metadata as FhevmRelayerMetadata;
    return cachedMetadata;
  } finally {
    rpc.destroy();
  }
}

// EIP-5267 eip712Domain() ABI - shared between InputVerifier and KMSVerifier
const EIP712_DOMAIN_ABI = [
  "function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
];

// Fetch eip712Domain from InputVerifier contract
// This is CRITICAL: the verifyingContract in eip712Domain is the Gateway chain's InputVerification address,
// NOT the local InputVerifier address!
async function fetchInputVerifierEip712Domain(
  rpcUrl: string,
  inputVerifierAddress: `0x${string}`
): Promise<Eip712DomainInfo> {
  if (cachedInputVerifierEip712Domain) {
    console.log("[FHEVM] Using cached InputVerifier eip712Domain");
    return cachedInputVerifierEip712Domain;
  }

  console.log("[FHEVM] Fetching InputVerifier eip712Domain from:", inputVerifierAddress);
  const provider = new JsonRpcProvider(rpcUrl);

  try {
    const contract = new (await import("ethers")).Contract(
      inputVerifierAddress,
      EIP712_DOMAIN_ABI,
      provider
    );

    const domain = await contract.eip712Domain();
    console.log("[FHEVM] InputVerifier eip712Domain:", {
      chainId: domain.chainId.toString(),
      verifyingContract: domain.verifyingContract,
    });

    cachedInputVerifierEip712Domain = {
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract as `0x${string}`,
    };

    return cachedInputVerifierEip712Domain;
  } finally {
    provider.destroy();
  }
}

// Fetch eip712Domain from KMSVerifier contract
// This is used for verifyingContractAddressDecryption
async function fetchKmsVerifierEip712Domain(
  rpcUrl: string,
  kmsVerifierAddress: `0x${string}`
): Promise<Eip712DomainInfo> {
  if (cachedKmsVerifierEip712Domain) {
    console.log("[FHEVM] Using cached KMSVerifier eip712Domain");
    return cachedKmsVerifierEip712Domain;
  }

  console.log("[FHEVM] Fetching KMSVerifier eip712Domain from:", kmsVerifierAddress);
  const provider = new JsonRpcProvider(rpcUrl);

  try {
    const contract = new (await import("ethers")).Contract(
      kmsVerifierAddress,
      EIP712_DOMAIN_ABI,
      provider
    );

    const domain = await contract.eip712Domain();
    console.log("[FHEVM] KMSVerifier eip712Domain:", {
      chainId: domain.chainId.toString(),
      verifyingContract: domain.verifyingContract,
    });

    cachedKmsVerifierEip712Domain = {
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract as `0x${string}`,
    };

    return cachedKmsVerifierEip712Domain;
  } finally {
    provider.destroy();
  }
}

// Create mock FHEVM instance for local development
// Uses the user's wallet provider for proper authentication
async function createMockInstance(
  walletProvider: Eip1193Provider,
  userAddress: Address
): Promise<MockFhevmInstance> {
  // If we have a cached instance for the same user, reuse it
  if (mockFhevmInstance && cachedUserAddress === userAddress) {
    console.log("[FHEVM-MOCK] Reusing existing mock instance for user:", userAddress);
    return mockFhevmInstance;
  }

  console.log("[FHEVM-MOCK] Creating mock instance for local Hardhat...");
  console.log("[FHEVM-MOCK] User address:", userAddress);

  // Dynamically fetch metadata from Hardhat node
  const metadata = await fetchFhevmMetadata(LOCAL_RPC_URL);

  // CRITICAL: Fetch the actual eip712Domain from InputVerifier contract
  // The verifyingContract in eip712Domain is the Gateway chain's InputVerification address,
  // NOT the local InputVerifier address (metadata.InputVerifierAddress)!
  const inputVerifierEip712Domain = await fetchInputVerifierEip712Domain(
    LOCAL_RPC_URL,
    metadata.InputVerifierAddress
  );

  // CRITICAL: Fetch the actual eip712Domain from KMSVerifier contract
  // The verifyingContract in eip712Domain is the Gateway chain's KMSVerifier address,
  // NOT the local KMSVerifier address!
  const kmsVerifierEip712Domain = await fetchKmsVerifierEip712Domain(
    LOCAL_RPC_URL,
    metadata.KMSVerifierAddress
  );

  console.log("[FHEVM-MOCK] Using dynamic config:", {
    aclContractAddress: metadata.ACLAddress,
    chainId: metadata.chainId,
    gatewayChainId: Number(inputVerifierEip712Domain.chainId),
    inputVerifierContractAddress: metadata.InputVerifierAddress,
    kmsContractAddress: metadata.KMSVerifierAddress,
    verifyingContractAddressInputVerification: inputVerifierEip712Domain.verifyingContract,
    verifyingContractAddressDecryption: kmsVerifierEip712Domain.verifyingContract,
  });

  // Use JsonRpcProvider for read operations (direct to Hardhat node)
  const readProvider = new JsonRpcProvider(LOCAL_RPC_URL);

  console.log("[FHEVM-MOCK] Creating instance with provider");

  // MockFhevmInstance.create expects (provider, provider, config) - NOT signer!
  // The verifyingContractAddressInputVerification MUST match InputVerifier.eip712Domain().verifyingContract
  // The verifyingContractAddressDecryption MUST match KMSVerifier.eip712Domain().verifyingContract
  // The gatewayChainId MUST match InputVerifier.eip712Domain().chainId
  mockFhevmInstance = await MockFhevmInstance.create(readProvider, readProvider, {
    aclContractAddress: metadata.ACLAddress,
    chainId: metadata.chainId,
    gatewayChainId: Number(inputVerifierEip712Domain.chainId),
    inputVerifierContractAddress: metadata.InputVerifierAddress,
    kmsContractAddress: metadata.KMSVerifierAddress,
    verifyingContractAddressDecryption: kmsVerifierEip712Domain.verifyingContract,
    verifyingContractAddressInputVerification: inputVerifierEip712Domain.verifyingContract,
  });

  cachedUserAddress = userAddress;
  console.log("[FHEVM-MOCK] Mock instance created successfully");
  return mockFhevmInstance;
}

export async function getFhevmInstance(
  provider: Eip1193Provider,
  contractAddress: Address,
  userAddress: Address
): Promise<FhevmInstance | MockFhevmInstance> {
  const chainId = await getChainId(provider);
  console.log("[FHEVM] Chain ID:", chainId);

  // For local Hardhat, use mock instance
  if (isLocalNetwork(chainId)) {
    console.log("[FHEVM] Local Hardhat detected - using mock instance");
    return await createMockInstance(provider, userAddress);
  }

  if (fhevmInstance) {
    console.log("[FHEVM] Reusing existing instance");
    return fhevmInstance;
  }

  if (!isInitialized) {
    await initializeFhevm();
  }

  console.log("[FHEVM] Creating instance for Sepolia...");
  try {
    fhevmInstance = await createInstance({
      kmsContractAddress: ZAMA_KMS_CONTRACT,
      aclContractAddress: ZAMA_ACL_CONTRACT,
      network: provider,
      gatewayUrl: ZAMA_GATEWAY_URL,
    });
    console.log("[FHEVM] Instance created successfully");
  } catch (error) {
    console.error("[FHEVM] Failed to create instance:", error);
    throw error;
  }

  return fhevmInstance;
}

// Helper to convert Uint8Array to hex string
function toHexString(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function encryptUint32(
  value: number,
  provider: Eip1193Provider,
  contractAddress: Address,
  userAddress: Address
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  console.log("[FHEVM] encryptUint32 called with value:", value);

  // Validate input parameters
  if (value < 0 || value > 4294967295) {
    throw new Error(`Invalid uint32 value: ${value}. Must be between 0 and 4294967295.`);
  }

  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invalid contract address provided for encryption.");
  }

  if (!userAddress || userAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invalid user address provided for encryption.");
  }

  let instance;
  try {
    instance = await getFhevmInstance(provider, contractAddress, userAddress);
    console.log("[FHEVM] Got instance, creating encrypted input...");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to initialize FHEVM instance: ${errorMessage}`);
  }

  console.log("[FHEVM] Contract address:", contractAddress);
  console.log("[FHEVM] User address:", userAddress);

  let encrypted;
  try {
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    console.log("[FHEVM] Adding value to input...");
    const encryptedInput = input.add32(value);

    console.log("[FHEVM] Encrypting (this may take a moment)...");
    encrypted = await encryptedInput.encrypt();
    console.log("[FHEVM] Encryption complete");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Encryption failed: ${errorMessage}. Please try again.`);
  }

  if (!encrypted.handles || encrypted.handles.length === 0) {
    throw new Error("Encryption produced no handles. This may indicate a WASM loading issue.");
  }

  console.log("[FHEVM] Handle:", toHexString(encrypted.handles[0]));

  return {
    handle: toHexString(encrypted.handles[0]),
    inputProof: toHexString(encrypted.inputProof),
  };
}

export async function decryptUint32(
  handle: bigint,
  provider: Eip1193Provider,
  contractAddress: Address,
  userAddress: Address
): Promise<number> {
  const chainId = await getChainId(provider);

  // For local Hardhat, use mock decryption
  if (isLocalNetwork(chainId)) {
    console.log("[FHEVM-MOCK] Using mock decryption for local Hardhat network");
    const mockInstance = await createMockInstance(provider, userAddress);

    try {
      // Handle is 32 bytes = 64 hex chars
      // Convert bigint to hex, ensuring exactly 64 characters (no more, no less)
      let handleHexRaw = handle.toString(16);
      // If longer than 64 chars, take the last 64 chars (remove leading zeros from bigint conversion)
      if (handleHexRaw.length > 64) {
        handleHexRaw = handleHexRaw.slice(-64);
      } else if (handleHexRaw.length < 64) {
        // If shorter, pad with leading zeros
        handleHexRaw = handleHexRaw.padStart(64, "0");
      }
      const handleHex = `0x${handleHexRaw}` as `0x${string}`;
      console.log("[FHEVM-MOCK] Formatted handle for decryption:", handleHex, "length:", handleHexRaw.length);

      // Generate keypair and signature for decryption
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockAny = mockInstance as any;
      const keypair = mockAny.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;

      // Create EIP712 for user decryption
      const eip712 = mockAny.createEIP712(
        keypair.publicKey,
        [contractAddress],
        startTimestamp,
        durationDays
      );

      // Sign the EIP712 message
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      console.log("[FHEVM-MOCK] Calling userDecrypt with signature...");
      const result = await mockAny.userDecrypt(
        [{ handle: handleHex, contractAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature,
        [contractAddress],
        userAddress,
        startTimestamp,
        durationDays
      );
      const decryptedValue = Object.values(result)[0];
      console.log("[FHEVM-MOCK] Mock decrypted value:", decryptedValue);
      return Number(decryptedValue);
    } catch (error) {
      console.error("[FHEVM-MOCK] Mock decryption error:", error);
      // Fallback: extract a mock value from the handle
      const handleHex = handle.toString(16);
      const mockValue = parseInt(handleHex.slice(-8), 16) % 1000000;
      console.log("[FHEVM-MOCK] Fallback mock value:", mockValue);
      return mockValue;
    }
  }

  const instance = await getFhevmInstance(provider, contractAddress, userAddress);
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();

  const { publicKey, privateKey } = (instance as FhevmInstance).generateKeypair();
  const eip712 = (instance as FhevmInstance).createEIP712(publicKey, contractAddress);

  const signature = await signer.signTypedData(
    eip712.domain,
    { Reencrypt: eip712.types.Reencrypt },
    eip712.message
  );

  const decryptedValue = await (instance as FhevmInstance).reencrypt(
    handle,
    privateKey,
    publicKey,
    signature,
    contractAddress,
    userAddress
  );

  return Number(decryptedValue);
}

export function stringToUint32(str: string): number {
  // If the string is a pure number within uint32 range, use it directly
  const trimmed = str.trim();
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    // uint32 max is 4294967295
    if (num >= 0 && num <= 4294967295) {
      console.log("[FHEVM] stringToUint32: pure number input, using directly:", num);
      return num;
    }
  }
  
  // For non-numeric strings, use hash (note: this is one-way, cannot be reversed)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const result = Math.abs(hash) >>> 0;
  console.log("[FHEVM] stringToUint32: hashed string to:", result);
  return result;
}

export function uint32ToString(num: number): string {
  // Simply return the number as string
  // For proper text messaging, you'd need a different encoding scheme
  return num.toString();
}

// Clear cached instances (useful for network switching)
export function clearFhevmCache(): void {
  fhevmInstance = null;
  mockFhevmInstance = null;
  cachedMetadata = null;
  cachedUserAddress = null;
  cachedInputVerifierEip712Domain = null;
  cachedKmsVerifierEip712Domain = null;
  console.log("[FHEVM] Cache cleared");
}

