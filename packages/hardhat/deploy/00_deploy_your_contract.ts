import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the BountyPlatform contract for BountySwipe Social-Fi platform
 */
const deployBountyPlatform: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("BountyPlatform", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const bountyPlatform = await hre.ethers.getContract<Contract>("BountyPlatform", deployer);
  console.log("BountyPlatform deployed! Owner:", await bountyPlatform.owner());
};

export default deployBountyPlatform;

deployBountyPlatform.tags = ["BountyPlatform"];
