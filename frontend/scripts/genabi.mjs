import * as fs from "fs";
import * as path from "path";

// Contract configuration
const CONTRACTS = [
  { name: "NeonCrypt", optional: true },
  { name: "FHECounter", optional: true },
];

// Relative path to hardhat project root
const rel = "..";

// Output directory for ABI files
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

const dir = path.resolve(rel);
const deploymentsDir = path.join(dir, "deployments");

const line =
  "\n===================================================================\n";

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir)) {
    if (!optional) {
      console.error(
        `${line}Unable to locate '${chainDeploymentDir}' directory.\n\n` +
        `1. Go to the root project directory\n` +
        `2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
      );
      process.exit(1);
    }
    return undefined;
  }

  const contractFile = path.join(chainDeploymentDir, `${contractName}.json`);
  if (!fs.existsSync(contractFile)) {
    if (!optional) {
      console.error(`${line}Contract ${contractName} not found in ${chainDeploymentDir}${line}`);
      process.exit(1);
    }
    return undefined;
  }

  const jsonString = fs.readFileSync(contractFile, "utf-8");
  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}

function processContract(contractName, optional) {
  console.log(`Processing ${contractName}...`);

  // Try to read deployments
  let deployLocalhost = readDeployment("localhost", 31337, contractName, true);
  let deploySepolia = readDeployment("sepolia", 11155111, contractName, true);

  // If neither deployment exists and not optional, exit
  if (!deployLocalhost && !deploySepolia && !optional) {
    console.error(`${line}No deployments found for ${contractName}${line}`);
    process.exit(1);
  }

  // If we have neither, skip this contract
  if (!deployLocalhost && !deploySepolia) {
    console.log(`Skipping ${contractName} - no deployments found`);
    return;
  }

  // Use localhost ABI as primary, fallback to Sepolia
  const primaryDeployment = deployLocalhost || deploySepolia;
  
  // Create default entries for missing deployments
  if (!deployLocalhost) {
    deployLocalhost = { 
      abi: primaryDeployment.abi, 
      address: "0x0000000000000000000000000000000000000000" 
    };
  }
  if (!deploySepolia) {
    deploySepolia = { 
      abi: primaryDeployment.abi, 
      address: "0x0000000000000000000000000000000000000000" 
    };
  }

  // Generate ABI file
  const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${contractName}ABI = ${JSON.stringify({ abi: primaryDeployment.abi }, null, 2)} as const;
`;

  // Generate Addresses file
  const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${contractName}Addresses = { 
  "11155111": { address: "${deploySepolia.address}", chainId: 11155111, chainName: "sepolia" },
  "31337": { address: "${deployLocalhost.address}", chainId: 31337, chainName: "hardhat" },
};
`;

  const abiPath = path.join(outdir, `${contractName}ABI.ts`);
  const addressesPath = path.join(outdir, `${contractName}Addresses.ts`);

  console.log(`Generated ${abiPath}`);
  console.log(`Generated ${addressesPath}`);
  console.log(tsAddresses);

  fs.writeFileSync(abiPath, tsCode, "utf-8");
  fs.writeFileSync(addressesPath, tsAddresses, "utf-8");
}

// Process all contracts
for (const contract of CONTRACTS) {
  processContract(contract.name, contract.optional);
}

console.log("\nABI generation complete!");
