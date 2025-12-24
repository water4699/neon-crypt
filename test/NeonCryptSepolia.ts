import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { NeonCrypt } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("NeonCryptSepolia", function () {
  let signers: Signers;
  let neonCryptContract: NeonCrypt;
  let neonCryptContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const NeonCryptDeployment = await deployments.get("NeonCrypt");
      neonCryptContractAddress = NeonCryptDeployment.address;
      neonCryptContract = await ethers.getContractAt("NeonCrypt", NeonCryptDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("submit and decrypt an encrypted message", async function () {
    steps = 8;
    this.timeout(4 * 60000); // 4 minutes timeout for Sepolia

    progress("Getting initial message count...");
    const initialCount = await neonCryptContract.getTotalMessages();
    console.log(`   Initial total messages: ${initialCount}`);

    progress("Encrypting message value...");
    const messageValue = Math.floor(Math.random() * 1000000); // Random message value
    const encryptedMessage = await fhevm
      .createEncryptedInput(neonCryptContractAddress, signers.alice.address)
      .add32(messageValue)
      .encrypt();

    progress(
      `Submitting encrypted message... NeonCrypt=${neonCryptContractAddress} signer=${signers.alice.address}`,
    );
    const tx = await neonCryptContract
      .connect(signers.alice)
      .submitMessage(encryptedMessage.handles[0], encryptedMessage.inputProof);
    await tx.wait();

    progress("Verifying message was stored...");
    const newCount = await neonCryptContract.getTotalMessages();
    expect(newCount).to.eq(initialCount + BigInt(1));
    console.log(`   New total messages: ${newCount}`);

    progress("Getting message details...");
    const messageId = newCount - BigInt(1);
    const [encryptedContent, timestamp, sender, isActive] = await neonCryptContract.getMessage(messageId);
    
    expect(sender).to.eq(signers.alice.address);
    expect(isActive).to.eq(true);
    console.log(`   Message sender: ${sender}`);
    console.log(`   Message timestamp: ${timestamp}`);
    console.log(`   Message active: ${isActive}`);

    progress(`Decrypting message content (handle=${encryptedContent})...`);
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedContent,
      neonCryptContractAddress,
      signers.alice,
    );

    progress(`Verifying decrypted value...`);
    expect(decryptedValue).to.eq(messageValue);
    console.log(`   Original value: ${messageValue}`);
    console.log(`   Decrypted value: ${decryptedValue}`);

    progress("Test completed successfully!");
  });

  it("get user messages", async function () {
    steps = 3;
    this.timeout(60000);

    progress("Getting user message list...");
    const userMessages = await neonCryptContract.getUserMessages(signers.alice.address);
    console.log(`   User has ${userMessages.length} messages`);

    progress("Getting user message metadata...");
    const [timestamps, messageIds, activeStatus] = await neonCryptContract.getUserMessageMetadata(
      signers.alice.address
    );
    console.log(`   Metadata retrieved for ${messageIds.length} messages`);

    progress("Test completed!");
    expect(userMessages.length).to.eq(messageIds.length);
  });
});

