import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding 12 Lattice Relics with deployer:", deployer.address);

  // Load deployed contract addresses
  const deploymentPath = path.join(__dirname, "../deployments/sepolia.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment file deployments/sepolia.json not found. Run deploy.ts first.");
  }
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const nftAddress = deploymentData.contracts.GameCardNFT.address;
  const marketplaceAddress = deploymentData.contracts.GameCardMarketplace.address;

  const GameCardNFT = await ethers.getContractFactory("GameCardNFT");
  const nft = GameCardNFT.attach(nftAddress) as any;

  const GameCardMarketplace = await ethers.getContractFactory("GameCardMarketplace");
  const marketplace = GameCardMarketplace.attach(marketplaceAddress) as any;

  // Define the 12 Lattice Relics matching reference design
  const seedCards = [
    {
      name: "Null Shard",
      type: "Fragment",
      rarity: "Common",
      priceEth: "0.002",
      stats: { energy: 34, stability: 81, signal: 22 },
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Aeon Key",
      type: "Access Relic",
      rarity: "Legendary",
      priceEth: "0.045",
      stats: { energy: 91, stability: 74, signal: 86 },
      image: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Ghost Circuit",
      type: "Neural Relic",
      rarity: "Epic",
      priceEth: "0.028",
      stats: { energy: 67, stability: 43, signal: 98 },
      image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Orbital Relic",
      type: "Navigation Artifact",
      rarity: "Rare",
      priceEth: "0.012",
      stats: { energy: 52, stability: 76, signal: 84 },
      image: "https://images.unsplash.com/photo-1614728894747-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Echo Mask",
      type: "Memory Artifact",
      rarity: "Legendary",
      priceEth: "0.038",
      stats: { energy: 78, stability: 61, signal: 94 },
      image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Chrono Engine",
      type: "Temporal Artifact",
      rarity: "Mythic",
      priceEth: "0.089",
      stats: { energy: 99, stability: 28, signal: 97 },
      image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Memory Prism",
      type: "Archive Artifact",
      rarity: "Rare",
      priceEth: "0.014",
      stats: { energy: 63, stability: 88, signal: 72 },
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Gravity Lens",
      type: "Physics Artifact",
      rarity: "Epic",
      priceEth: "0.026",
      stats: { energy: 82, stability: 67, signal: 59 },
      image: "https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Singularity Seed",
      type: "Core Artifact",
      rarity: "Mythic",
      priceEth: "0.095",
      stats: { energy: 100, stability: 17, signal: 100 },
      image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Phantom Drive",
      type: "Mobility Artifact",
      rarity: "Epic",
      priceEth: "0.025",
      stats: { energy: 89, stability: 48, signal: 76 },
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Solar Heart",
      type: "Energy Core",
      rarity: "Legendary",
      priceEth: "0.043",
      stats: { energy: 96, stability: 83, signal: 65 },
      image: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Obsidian Protocol",
      type: "Lattice Authority",
      rarity: "Mythic",
      priceEth: "0.085",
      stats: { energy: 93, stability: 95, signal: 100 },
      image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80",
    },
  ];

  // Set approval for marketplace
  console.log("Approving Marketplace for NFT transfers...");
  const approveTx = await nft.setApprovalForAll(marketplaceAddress, true);
  await approveTx.wait();

  // Mint and List each card
  for (let i = 0; i < seedCards.length; i++) {
    const card = seedCards[i];
    const metadataUri = `ipfs://QmSeedCard${i + 1}/${card.name.replace(/\s+/g, "_").toLowerCase()}`;

    console.log(`Minting Card #${i + 1}: ${card.name} (${card.rarity})`);
    const mintTx = await nft.mintCard(deployer.address, metadataUri);
    await mintTx.wait();

    const priceWei = ethers.parseEther(card.priceEth);
    console.log(`Listing Card #${i + 1} for ${card.priceEth} ETH...`);
    const listTx = await marketplace.listItem(nftAddress, i + 1, priceWei);
    await listTx.wait();
  }

  console.log("\n Successfully seeded all 12 Lattice Relic NFTs on-chain!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
