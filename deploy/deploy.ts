import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy NeonCrypt contract
  const deployedNeonCrypt = await deploy("NeonCrypt", {
    from: deployer,
    log: true,
  });

  console.log(`NeonCrypt contract: `, deployedNeonCrypt.address);
};

export default func;
func.id = "deploy_neonCrypt"; // id required to prevent reexecution
func.tags = ["NeonCrypt"];
