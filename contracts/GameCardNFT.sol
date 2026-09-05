// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameCardNFT
 * @dev OpenZeppelin v5 ERC721 Token for FOUNDATION ORACLE game cards with token URI storage and auto-incrementing IDs.
 */
contract GameCardNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event CardMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI);

    constructor(address initialOwner)
        ERC721("Foundation Oracle Card", "MRC")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mints a new Game Card NFT to the target recipient.
     * @param recipient Address receiving the card NFT.
     * @param _tokenURI Metadata URI pointing to card attributes/images.
     * @return tokenId The auto-incremented token ID of the minted card.
     */
    function mintCard(address recipient, string memory _tokenURI) public returns (uint256) {
        require(recipient != address(0), "Invalid recipient address");
        _nextTokenId++;
        uint256 newItemId = _nextTokenId;

        _safeMint(recipient, newItemId);
        _setTokenURI(newItemId, _tokenURI);

        emit CardMinted(recipient, newItemId, _tokenURI);
        return newItemId;
    }
}
