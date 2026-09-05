// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MythicMarketplace
 * @dev Non-custodial marketplace for MYTHIC REALMS NFT trading.
 */
contract MythicMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 listingId;
        address nftContract;
        uint256 tokenId;
        address payable seller;
        uint256 price;
        bool active;
    }

    uint256 private _listingIdCounter;

    // listingId => Listing
    mapping(uint256 => Listing) public listings;
    // nftContract => tokenId => listingId
    mapping(address => mapping(uint256 => uint256)) public tokenToListing;

    event CardListed(
        uint256 indexed listingId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );

    event CardSold(
        uint256 indexed listingId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );

    event CardDelisted(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId
    );

    function listCard(address nftContract, uint256 tokenId, uint256 price) external nonReentrant returns (uint256) {
        require(price > 0, "Price must be greater than zero");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Caller is not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "Marketplace not approved to transfer NFT"
        );

        _listingIdCounter++;
        uint256 listingId = _listingIdCounter;

        listings[listingId] = Listing({
            listingId: listingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: payable(msg.sender),
            price: price,
            active: true
        });

        tokenToListing[nftContract][tokenId] = listingId;

        emit CardListed(listingId, nftContract, tokenId, msg.sender, price);
        return listingId;
    }

    function buyCard(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing is not active");
        require(msg.value >= listing.price, "Insufficient payment");

        listing.active = false;
        address seller = listing.seller;

        IERC721(listing.nftContract).safeTransferFrom(seller, msg.sender, listing.tokenId);
        payable(seller).transfer(msg.value);

        emit CardSold(listingId, listing.nftContract, listing.tokenId, seller, msg.sender, listing.price);
    }

    function delistCard(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing is not active");
        require(listing.seller == msg.sender, "Only seller can delist");

        listing.active = false;

        emit CardDelisted(listingId, msg.sender, listing.tokenId);
    }

    function fetchActiveListings() external view returns (Listing[] memory) {
        uint256 total = _listingIdCounter;
        uint256 activeCount = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (listings[i].active) {
                activeCount++;
            }
        }

        Listing[] memory items = new Listing[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (listings[i].active) {
                items[currentIndex] = listings[i];
                currentIndex++;
            }
        }
        return items;
    }
}
