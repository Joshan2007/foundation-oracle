'use client';

import React, { useState } from 'react';
import { Tag, Zap, Shield, Radio, Sparkles, X, Check, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import { CardItem } from './MarketplaceGrid';
import contractsConfig from '../config/contracts.json';
import DecryptedText from './DecryptedText';
import KineticText from './KineticText';
import { useAudio } from './AudioEngine';

interface CollectionGridProps {
  walletAddress: string | null;
  onCardListed?: (card: CardItem) => void;
  extraCards?: CardItem[];
  listedCards?: CardItem[];
  onTransactionComplete?: () => void;
}

const INITIAL_OWNED_CARDS: CardItem[] = [];

export default function CollectionGrid({
  walletAddress,
  onCardListed,
  extraCards = [],
  listedCards = [],
  onTransactionComplete,
}: CollectionGridProps) {
  const [ownedCards, setOwnedCards] = useState<CardItem[]>(INITIAL_OWNED_CARDS);
  const [selectedCardForSale, setSelectedCardForSale] = useState<CardItem | null>(null);
  const [listPriceEth, setListPriceEth] = useState<string>('0.15');
  const [isListing, setIsListing] = useState(false);
  const [listingMessage, setListingMessage] = useState<string | null>(null);

  const { playHover, playClick, playSuccess } = useAudio();

  // Merge extraCards (minted + purchased) into ownedCards, excluding any card that is listed for sale
  const allOwnedCards = React.useMemo(() => {
    const listedIds = new Set(listedCards.map((c) => c.tokenId));
    const base = ownedCards.filter((c) => !listedIds.has(c.tokenId));
    const existingIds = new Set(base.map((c) => c.tokenId));
    for (const card of extraCards) {
      if (!existingIds.has(card.tokenId) && !listedIds.has(card.tokenId)) {
        base.unshift(card);
        existingIds.add(card.tokenId);
      }
    }
    return base;
  }, [ownedCards, extraCards, listedCards]);

  React.useEffect(() => {
    const fetchRealCards = async () => {
      if (!walletAddress) return;

      try {
        let provider: ethers.Provider;
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          provider = new ethers.BrowserProvider((window as any).ethereum);
          try {
            await provider.getBlockNumber();
          } catch (e) {
            provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
          }
        } else {
          provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        }

        const nftAddress = (contractsConfig as any).contracts?.GameCardNFT?.address || "";
        const nftAbi = (contractsConfig as any).contracts?.GameCardNFT?.abi || [];
        const nftContract = new ethers.Contract(nftAddress, nftAbi, provider);

        const mints = await nftContract.queryFilter('CardMinted', 0).catch(() => []);
        const transfers = await nftContract.queryFilter('Transfer', 0).catch(() => []);

        const tokenIds = new Set<number>();
        for (const ev of [...mints, ...transfers]) {
          const args = (ev as any).args;
          if (args && args.tokenId) tokenIds.add(Number(args.tokenId));
        }

        const mktAddress = (contractsConfig as any).contracts?.GameCardMarketplace?.address || (contractsConfig as any).contracts?.MythicMarketplace?.address || "";
        const mktAbi = (contractsConfig as any).contracts?.GameCardMarketplace?.abi || (contractsConfig as any).contracts?.MythicMarketplace?.abi || [];
        const mktContract = new ethers.Contract(mktAddress, mktAbi, provider);

        const realCards: CardItem[] = [];
        for (const tid of Array.from(tokenIds)) {
          try {
            const owner = await nftContract.ownerOf(tid);
            if (owner.toLowerCase() === walletAddress.toLowerCase()) {
              
              // Check if card is currently listed in the marketplace
              const listing = await mktContract.getListing(nftAddress, tid);
              if (listing && listing.price > BigInt(0)) {
                continue; // Skip this card, it's currently on the market!
              }

              // 1. Check localStorage first
              let metadata = {
                name: 'Forged Relic #' + tid,
                description: 'Authentic on-chain forged card.',
                image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=800&q=80',
                rarity: 'Mythic' as const,
                type: 'FORGED',
                stats: { energy: 99, stability: 99, signal: 99 },
              };

              if (typeof window !== 'undefined') {
                const localMeta = localStorage.getItem(`card_meta_${tid}`);
                if (localMeta) {
                  try {
                    metadata = { ...metadata, ...JSON.parse(localMeta) };
                  } catch (e) {}
                }
              }

              // 2. Query tokenURI if needed
              let tokenURI = '';
              try {
                tokenURI = await nftContract.tokenURI(tid);
              } catch (e) {}

              if (tokenURI) {
                let fetchUrl = tokenURI;
                if (tokenURI.startsWith('ipfs://')) {
                  fetchUrl = `https://gateway.pinata.cloud/ipfs/${tokenURI.replace('ipfs://', '')}`;
                }
                if (fetchUrl.startsWith('http')) {
                  try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1500);
                    const res = await fetch(fetchUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    const data = await res.json();
                    metadata = { ...metadata, ...data };
                  } catch (e) {}
                }
              }

              realCards.push({
                listingId: 0,
                tokenId: tid,
                name: metadata.name,
                description: metadata.description,
                image: metadata.image,
                rarity: (metadata.rarity as any) || 'Mythic',
                type: metadata.type || 'FORGED',
                price: '0.00',
                seller: walletAddress,
                stats: metadata.stats || { energy: 99, stability: 99, signal: 99 },
              });
            }
          } catch (e) {}
        }
        
        setOwnedCards(realCards.reverse());
      } catch(err) {
        console.error('Error fetching on-chain collection:', err);
      }
    };
    fetchRealCards();
  }, [walletAddress]);

  const handleOpenListModal = (card: CardItem) => {
    if (!walletAddress) {
      alert('Please connect your Web3 wallet to list your card for sale.');
      return;
    }
    playClick();
    setSelectedCardForSale(card);
    setListPriceEth('0.15');
    setListingMessage(null);
  };

  const isListingRef = React.useRef(false);

  const handleExecuteListing = async () => {
    if (!selectedCardForSale || !walletAddress) return;
    if (isListingRef.current) return;
    if (!listPriceEth || parseFloat(listPriceEth) <= 0) {
      alert('Please specify a valid price in ETH.');
      return;
    }

    try {
      isListingRef.current = true;
      playClick();
      setIsListing(true);
      setListingMessage('Checking marketplace approvals...');

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error('No provider');

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const nftAddress = (contractsConfig as any).contracts?.GameCardNFT?.address || "";
      const nftAbi = (contractsConfig as any).contracts?.GameCardNFT?.abi || [];
      const mktAddress = (contractsConfig as any).contracts?.GameCardMarketplace?.address || (contractsConfig as any).contracts?.MythicMarketplace?.address || "";
      const mktAbi = (contractsConfig as any).contracts?.GameCardMarketplace?.abi || (contractsConfig as any).contracts?.MythicMarketplace?.abi || [];

      const nftContract = new ethers.Contract(nftAddress, nftAbi, signer);
      const mktContract = new ethers.Contract(mktAddress, mktAbi, signer);

      // Check if marketplace is already approved (avoids multiple MetaMask prompts!)
      let isApproved = false;
      try {
        isApproved = await nftContract.isApprovedForAll(signerAddress, mktAddress);
        if (!isApproved) {
          const approved = await nftContract.getApproved(selectedCardForSale.tokenId);
          if (approved && approved.toLowerCase() === mktAddress.toLowerCase()) {
            isApproved = true;
          }
        }
      } catch (checkErr) {
        console.warn('Approval check notice:', checkErr);
      }

      if (!isApproved) {
        setListingMessage('Step 1/2: Authorizing Marketplace (one-time approval)...');
        const approveTx = await nftContract.setApprovalForAll(mktAddress, true, { gasLimit: 100000 });
        await approveTx.wait();
      }

      // Step 2: Call listItem on Marketplace contract
      setListingMessage('Broadcasting listing transaction to Ethereum...');
      const priceWei = ethers.parseEther(listPriceEth);
      const listTx = await mktContract.listItem(nftAddress, selectedCardForSale.tokenId, priceWei, { gasLimit: 250000 });
      await listTx.wait();

      setListingMessage('Card successfully listed on Mythic Marketplace!');
      playSuccess();

      // Refresh ETH balance (gas was spent)
      if (onTransactionComplete) onTransactionComplete();

      setTimeout(() => {
        const updatedCard = { ...selectedCardForSale, price: listPriceEth, seller: walletAddress };
        setOwnedCards((prev) => prev.filter((c) => c.tokenId !== selectedCardForSale.tokenId));
        if (onCardListed) onCardListed(updatedCard);
        setSelectedCardForSale(null);
        setIsListing(false);
        setListingMessage(null);
      }, 1500);
    } catch (err: any) {
      console.error('Listing error:', err);
      const errMsg = err.reason || err.shortMessage || err.message || 'Listing failed';
      setListingMessage(`Listing Failed: ${errMsg}`);
      setTimeout(() => {
        setIsListing(false);
      }, 3000);
    } finally {
      isListingRef.current = false;
    }
  };

  const getRarityBadgeClass = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'mythic': return 'badge-mythic';
      case 'legendary': return 'badge-legendary';
      case 'epic': return 'badge-epic';
      case 'rare': return 'badge-rare';
      default: return 'badge-common';
    }
  };

  const getRarityBorderClass = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'mythic': return 'border-rarity-mythic';
      case 'legendary': return 'border-rarity-legendary';
      case 'epic': return 'border-rarity-epic';
      case 'rare': return 'border-rarity-rare';
      default: return 'border-rarity-common';
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="runic-panel p-6 rounded-2xl flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-slate-100">YOUR CARD RELIQUARY</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            {walletAddress ? `Connected: ${walletAddress.substring(0, 8)}...` : 'Connect wallet to view on-chain inventory'}
          </p>
        </div>
        <div className="px-4 py-2 bg-obsidian-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-300">
          OWNED CARDS: <span className="text-slate-100 font-bold">{allOwnedCards.length}</span>
        </div>
      </div>

      {allOwnedCards.length === 0 ? (
        <div className="runic-panel p-12 text-center rounded-2xl space-y-3">
          <Sparkles className="w-12 h-12 text-amber-500 mx-auto" />
          <h4 className="text-lg font-serif font-bold text-slate-300">No Owned Cards in Reliquary</h4>
          <p className="text-xs text-slate-500 font-mono">Head over to FORGE to mint new cards or MARKET to purchase relics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {allOwnedCards.map((card) => (
            <div
              key={card.tokenId}
              className={`group relative rounded-2xl overflow-hidden bg-obsidian-950/35 backdrop-blur-sm border-2 transition-all duration-300 hover:z-10 shadow-lg hover:shadow-2xl ${getRarityBorderClass(
                card.rarity
              )}`}
              style={{ transformStyle: 'preserve-3d' }}
              onMouseEnter={playHover}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                el.style.transition = 'none';
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -6;
                const rotateY = ((x - centerX) / centerX) * 6;
                el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale3d(1.02, 1.02, 1.02)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transition = 'all 0.5s ease-out';
                el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)';
              }}
            >
              <div className="relative h-64 overflow-hidden bg-obsidian-950/50">
                <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase ${getRarityBadgeClass(card.rarity)}`}>
                    {card.rarity}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-obsidian-950/80 border border-slate-700 text-slate-300">
                    TOKEN #{card.tokenId}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xl font-display font-bold text-slate-100">
                    <KineticText text={card.name} />
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">{card.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="stat-energy px-2 py-1 rounded-lg text-center">
                    <div className="font-telemetry">ENERGY</div>
                    <div className="text-xs font-mono font-bold">{card.stats.energy}</div>
                  </div>
                  <div className="stat-stability px-2 py-1 rounded-lg text-center">
                    <div className="font-telemetry">STABIL</div>
                    <div className="text-xs font-mono font-bold">{card.stats.stability}</div>
                  </div>
                  <div className="stat-signal px-2 py-1 rounded-lg text-center">
                    <div className="font-telemetry">SIGNAL</div>
                    <div className="text-xs font-mono font-bold">{card.stats.signal}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenListModal(card)}
                  onMouseEnter={playHover}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-obsidian-850 border border-accent-cyan/50 text-slate-100 font-bold font-mono text-xs tracking-wider hover:bg-accent-cyan hover:text-obsidian-950 transition-all shadow-sm cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>LIST FOR SALE</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List For Sale Modal */}
      {selectedCardForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-md runic-panel rounded-3xl overflow-hidden border-2 border-accent-cyan/60 shadow-2xl p-6 space-y-6">
            <button
              onClick={() => { playClick(); setSelectedCardForSale(null); }}
              onMouseEnter={playHover}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-display text-slate-100">LIST RELIC FOR SALE</h3>
              <p className="text-xs text-slate-400 font-mono">Set your listing price in ETH for card #{selectedCardForSale.tokenId}</p>
            </div>

            <div className="p-4 bg-obsidian-900 border border-slate-800 rounded-2xl flex items-center space-x-4">
              <img src={selectedCardForSale.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-700" />
              <div>
                <div className="text-lg font-display text-slate-100">{selectedCardForSale.name}</div>
                <div className="font-telemetry text-amber-400">{selectedCardForSale.rarity} {selectedCardForSale.type}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-telemetry text-slate-300">LISTING PRICE (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={listPriceEth}
                onChange={(e) => setListPriceEth(e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-700 text-slate-100 text-base font-mono font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-accent-cyan"
                placeholder="0.15"
              />
            </div>

            <button
              onClick={handleExecuteListing}
              onMouseEnter={playHover}
              disabled={isListing}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-100 text-obsidian-950 hover:bg-accent-cyan text-obsidian-950 font-bold font-mono text-xs tracking-wider shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isListing ? 'LISTING ON-CHAIN...' : 'CONFIRM MARKET LISTING'}</span>
            </button>

            {listingMessage && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl font-telemetry text-amber-300 text-center animate-pulse">
                {listingMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
