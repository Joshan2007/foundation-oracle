import { expect } from "chai";
import { ethers } from "hardhat";
import { GameCardNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GameCardNFT", function () {
  let nft: GameCardNFT;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const TOKEN_URI_1 = "https://mythicrealms.io/metadata/1.json";
  const TOKEN_URI_2 = "https://mythicrealms.io/metadata/2.json";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GameCardNFT");
    nft = (await Factory.deploy(owner.address)) as GameCardNFT;
    await nft.waitForDeployment();
  });

  describe("Deployment & Initialization", function () {
    it("should deploy with correct name and symbol", async function () {
      expect(await nft.name()).to.equal("Foundation Oracle Card");
      expect(await nft.symbol()).to.equal("MRC");
    });

    it("should set initial owner correctly", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("should mint a card with auto-incrementing token ID starting at 1", async function () {
      const tx1 = await nft.mintCard(user1.address, TOKEN_URI_1);
      await tx1.wait();

      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.tokenURI(1)).to.equal(TOKEN_URI_1);

      const tx2 = await nft.mintCard(user2.address, TOKEN_URI_2);
      await tx2.wait();

      expect(await nft.ownerOf(2)).to.equal(user2.address);
      expect(await nft.tokenURI(2)).to.equal(TOKEN_URI_2);
    });

    it("should emit CardMinted event upon minting", async function () {
      await expect(nft.mintCard(user1.address, TOKEN_URI_1))
        .to.emit(nft, "CardMinted")
        .withArgs(user1.address, 1, TOKEN_URI_1);
    });

    it("should reject minting to zero address", async function () {
      await expect(
        nft.mintCard(ethers.ZeroAddress, TOKEN_URI_1)
      ).to.be.revertedWith("Invalid recipient address");
    });
  });
});
