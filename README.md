# NeonCrypt

**FHE-powered Encrypted Messaging** - A decentralized messaging application that leverages Fully Homomorphic Encryption (FHE) to provide end-to-end encrypted communication on the blockchain.

## 🎬 Demo

[Watch Demo Video](./demo.mp4)

**Live Demo**: [https://neon-crypt-phi.vercel.app/](https://neon-crypt-phi.vercel.app/)

## ✨ Features

- **End-to-End Encryption**: Messages are encrypted using FHEVM technology before being stored on-chain
- **Decentralized Storage**: All encrypted messages are stored on the blockchain
- **Wallet Authentication**: Connect with MetaMask or other Web3 wallets via RainbowKit
- **Real-time Decryption**: Decrypt your messages on-demand with wallet signature
- **Network Support**: Works on local Hardhat network and Sepolia testnet
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity** ^0.8.24
- **Hardhat** for development and testing
- **FHEVM** by Zama for homomorphic encryption

### Frontend
- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **RainbowKit** + **wagmi** for wallet connection
- **fhevmjs** for client-side FHE operations

## 📁 Project Structure

```
neon-crypt/
├── contracts/              # Smart contracts
│   ├── NeonCrypt.sol       # Main messaging contract
│   └── FHECounter.sol      # Example FHE counter
├── deploy/                 # Deployment scripts
├── test/                   # Contract tests
├── tasks/                  # Hardhat tasks
├── frontend/               # Next.js frontend
│   ├── app/                # App router pages
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   └── fhevm/              # FHEVM integration
├── hardhat.config.ts       # Hardhat configuration
└── package.json            # Root dependencies
```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Package manager (recommended)
- **MetaMask**: Browser wallet extension

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/BradyRosa/neon-crypt.git
   cd neon-crypt
   ```

2. **Install dependencies**

   ```bash
   # Install root dependencies
   pnpm install

   # Install frontend dependencies
   cd frontend && pnpm install
   ```

3. **Set up environment variables**

   ```bash
   # For contract deployment
   npx hardhat vars set MNEMONIC
   npx hardhat vars set INFURA_API_KEY
   ```

### Running Locally

1. **Start the local Hardhat node**

   ```bash
   npx hardhat node
   ```

2. **Deploy contracts** (in a new terminal)

   ```bash
   npx hardhat deploy --network localhost
   ```

3. **Start the frontend** (in a new terminal)

   ```bash
   cd frontend
   pnpm dev
   ```

4. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Deploy to Sepolia

```bash
# Deploy contracts
npx hardhat deploy --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 📜 Smart Contract API

### NeonCrypt.sol

| Function | Description |
|----------|-------------|
| `submitMessage(encryptedContent, inputProof)` | Submit an encrypted message |
| `getMessage(messageId)` | Get message details by ID |
| `getUserMessages(user)` | Get all message IDs for a user |
| `getMessagesBatch(messageIds)` | Batch retrieve multiple messages |
| `deleteMessage(messageId)` | Soft delete a message |
| `isMessageActive(messageId)` | Check if message exists and is active |

### Events

- `MessageSubmitted(sender, messageId, timestamp)`
- `MessageDeleted(sender, messageId)`

## 📜 Available Scripts

### Root Directory

| Script | Description |
|--------|-------------|
| `pnpm compile` | Compile smart contracts |
| `pnpm test` | Run contract tests |
| `pnpm coverage` | Generate test coverage report |
| `pnpm lint` | Run linting checks |

### Frontend Directory

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

## 🔐 How FHE Works

1. **Encryption**: When you send a message, it's encrypted client-side using FHEVM
2. **On-chain Storage**: The encrypted ciphertext is stored in the smart contract
3. **Access Control**: Only authorized addresses can decrypt messages
4. **Decryption**: Use your wallet to sign and decrypt messages you have access to

## 📚 Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Zama Protocol](https://www.zama.ai/)
- [RainbowKit Docs](https://www.rainbowkit.com/docs)
- [wagmi Documentation](https://wagmi.sh/)

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with 🔐 FHE Technology by Zama**
