import { expect } from "chai";
import { ethers } from "hardhat";
import { GameCardNFT, GameCardMarketplace } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GameCardMarketplace", function () {
  let nft: GameCardNFT;
  let marketplace: GameCardMarketplace;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const TOKEN_URI = "https://mythicrealms.io/metadata/card1.json";
  const LIST_PRICE = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, seller, buyer, stranger] = await ethers.getSigners();

    // Deploy NFT Contract
    const NFTFactory = await ethers.getContractFactory("GameCardNFT");
    nft = (await NFTFactory.deploy(owner.address)) as GameCardNFT;
    await nft.waitForDeployment();

    // Deploy Marketplace Contract
    const MarketplaceFactory = await ethers.getContractFactory("GameCardMarketplace");
    marketplace = (await MarketplaceFactory.deploy()) as GameCardMarketplace;
    await marketplace.waitForDeployment();

    // Mint token ID 1 to seller
    await nft.mintCard(seller.address, TOKEN_URI);
  });

  describe("Listing Items", function () {
    it("should allow owner to list item when approved", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).approve(marketplaceAddress, 1);

      await expect(marketplace.connect(seller).listItem(await nft.getAddress(), 1, LIST_PRICE))
        .to.emit(marketplace, "CardListed")
        .withArgs(await nft.getAddress(), 1, seller.address, LIST_PRICE);

      const listing = await marketplace.getListing(await nft.getAddress(), 1);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LIST_PRICE);
    });

    it("should allow listing when approved using setApprovalForAll", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).setApprovalForAll(marketplaceAddress, true);

      await marketplace.connect(seller).listItem(await nft.getAddress(), 1, LIST_PRICE);

      const listing = await marketplace.getListing(await nft.getAddress(), 1);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LIST_PRICE);
    });

    it("should reject zero price listing", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).approve(marketplaceAddress, 1);

      await expect(
        marketplace.connect(seller).listItem(await nft.getAddress(), 1, 0)
      ).to.be.revertedWith("Price must be greater than zero");
    });

    it("should reject listing by non-owner", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).approve(marketplaceAddress, 1);

      await expect(
        marketplace.connect(stranger).listItem(await nft.getAddress(), 1, LIST_PRICE)
      ).to.be.revertedWith("Not the owner of the card");
    });

    it("should reject listing if marketplace is not approved", async function () {
      await expect(
        marketplace.connect(seller).listItem(await nft.getAddress(), 1, LIST_PRICE)
      ).to.be.revertedWith("Marketplace not approved to transfer card");
    });
  });

  describe("Cancelling Listings", function () {
    beforeEach(async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).approve(marketplaceAddress, 1);
      await marketplace.connect(seller).listItem(await nft.getAddress(), 1, LIST_PRICE);
    });

    it("should allow seller to cancel listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(await nft.getAddress(), 1))
        .to.emit(marketplace, "CardDelisted")
        .withArgs(await nft.getAddress(), 1, seller.address);

      const listing = await marketplace.getListing(await nft.getAddress(), 1);
      expect(listing.price).to.equal(0);
      expect(listing.seller).to.equal(ethers.ZeroAddress);
    });

    it("should reject cancellation by non-seller", async function () {
      await expect(
        marketplace.connect(stranger).cancelListing(await nft.getAddress(), 1)
      ).to.be.revertedWith("Not the seller");
    });

    it("should reject cancellation of non-listed item", async function () {
      await expect(
        marketplace.connect(seller).cancelListing(await nft.getAddress(), 999)
      ).to.be.revertedWith("Item is not listed");
    });
  });

  describe("Buying Items & ETH Transfers", function () {
    beforeEach(async function () {
      const marketplaceAddress = await marketplace.getAddress();
      await nft.connect(seller).approve(marketplaceAddress, 1);
      await marketplace.connect(seller).listItem(await nft.getAddress(), 1, LIST_PRICE);
    });

    it("should complete purchase, transfer NFT, and payout ETH to seller", async function () {
      const sellerInitialBalance = await ethers.provider.getBalance(seller.address);

      await expect(
        marketplace.connect(buyer).buyItem(await nft.getAddress(), 1, { value: LIST_PRICE })
      )
        .to.emit(marketplace, "CardSold")
        .withArgs(await nft.getAddress(), 1, buyer.address, seller.address, LIST_PRICE);

      // Verify NFT ownership transfer
      expect(await nft.ownerOf(1)).to.equal(buyer.address);

      // Verify ETH payout to seller
      const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
      expect(sellerFinalBalance - sellerInitialBalance).to.equal(LIST_PRICE);

      // Verify listing is removed
      const listing = await marketplace.getListing(await nft.getAddress(), 1);
      expect(listing.price).to.equal(0);
    });

    it("should reject purchase with incorrect payment amount", async function () {
      const lowerPrice = ethers.parseEther("0.5");
      await expect(
        marketplace.connect(buyer).buyItem(await nft.getAddress(), 1, { value: lowerPrice })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("should reject buying non-existent or unlisted item", async function () {
      await expect(
        marketplace.connect(buyer).buyItem(await nft.getAddress(), 999, { value: LIST_PRICE })
      ).to.be.revertedWith("Item is not listed");
    });

    it("should reject buying an item twice", async function () {
      await marketplace.connect(buyer).buyItem(await nft.getAddress(), 1, { value: LIST_PRICE });

      await expect(
        marketplace.connect(stranger).buyItem(await nft.getAddress(), 1, { value: LIST_PRICE })
      ).to.be.revertedWith("Item is not listed");
    });
  });
});
