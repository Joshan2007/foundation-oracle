// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameCardMarketplace
 * @dev Non-custodial marketplace for buying, listing, and cancelling MYTHIC REALMS game cards.
 */
contract GameCardMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
    }

    // nftAddress => (tokenId => Listing)
    mapping(address => mapping(uint256 => Listing)) private listings;

    event CardListed(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event CardSold(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 price
    );

    event CardDelisted(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller
    );

    /**
     * @notice List an NFT for sale on the marketplace.
     * @param nftAddress Contract address of the NFT.
     * @param tokenId ID of the token to list.
     * @param price Price in wei for the listing (must be > 0).
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external {
        require(price > 0, "Price must be greater than zero");

        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner of the card");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to transfer card"
        );

        listings[nftAddress][tokenId] = Listing({
            seller: msg.sender,
            price: price
        });

        emit CardListed(nftAddress, tokenId, msg.sender, price);
    }

    /**
     * @notice Buy a listed NFT card.
     * @param nftAddress Contract address of the NFT.
     * @param tokenId ID of the listed token.
     */
    function buyItem(address nftAddress, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftAddress][tokenId];
        require(listing.price > 0, "Item is not listed");
        require(msg.value == listing.price, "Incorrect payment amount");

        address seller = listing.seller;

        // Clear listing state before executing transfers
        delete listings[nftAddress][tokenId];

        // Transfer NFT from seller to buyer
        IERC721(nftAddress).safeTransferFrom(seller, msg.sender, tokenId);

        // Transfer ETH payment to seller
        (bool success, ) = payable(seller).call{value: msg.value}("");
        require(success, "ETH transfer failed");

        emit CardSold(nftAddress, tokenId, msg.sender, seller, listing.price);
    }

    /**
     * @notice Cancel an active NFT listing.
     * @param nftAddress Contract address of the NFT.
     * @param tokenId ID of the listed token.
     */
    function cancelListing(address nftAddress, uint256 tokenId) external {
        Listing memory listing = listings[nftAddress][tokenId];
        require(listing.price > 0, "Item is not listed");
        require(listing.seller == msg.sender, "Not the seller");

        delete listings[nftAddress][tokenId];

        emit CardDelisted(nftAddress, tokenId, msg.sender);
    }

    /**
     * @notice Retrieve active listing details for an NFT token.
     * @param nftAddress Contract address of the NFT.
     * @param tokenId ID of the token.
     * @return listing Listing struct containing seller and price.
     */
    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory listing)
    {
        return listings[nftAddress][tokenId];
    }
}
