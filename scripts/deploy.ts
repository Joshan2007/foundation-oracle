import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy GameCardNFT
  const GameCardNFTFactory = await ethers.getContractFactory("GameCardNFT");
  const nftContract = await GameCardNFTFactory.deploy(deployer.address);
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  console.log("GameCardNFT deployed to:", nftAddress);

  // 2. Deploy GameCardMarketplace
  const MarketplaceFactory = await ethers.getContractFactory("GameCardMarketplace");
  const marketplaceContract = await MarketplaceFactory.deploy();
  await marketplaceContract.waitForDeployment();
  const marketplaceAddress = await marketplaceContract.getAddress();
  console.log("GameCardMarketplace deployed to:", marketplaceAddress);

  // Prepare export payload with addresses and ABIs
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId ?? 31337,
    contracts: {
      GameCardNFT: {
        address: nftAddress,
        abi: JSON.parse(nftContract.interface.formatJson()),
      },
      GameCardMarketplace: {
        address: marketplaceAddress,
        abi: JSON.parse(marketplaceContract.interface.formatJson()),
      },
    },
  };

  const targetPaths = [
    path.join(__dirname, "../deployments/sepolia.json"),
    path.join(__dirname, "../frontend/src/config/contracts.json"),
  ];

  for (const filePath of targetPaths) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));
    console.log(`Saved deployment output to: ${filePath}`);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
