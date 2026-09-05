'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Shield, Radio, ShoppingBag, Eye, X, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import contractsConfig from '../config/contracts.json';
import DecryptedText from './DecryptedText';
import KineticText from './KineticText';
import { useAudio } from './AudioEngine';
import { addActivity } from '../utils/history';

export interface CardItem {
  listingId: number;
  tokenId: number;
  name: string;
  description: string;
  image: string;
  rarity: 'Mythic' | 'Legendary' | 'Epic' | 'Rare' | 'Common';
  type: string;
  price: string; // in ETH
  seller: string;
  stats: {
    energy: number;
    stability: number;
    signal: number;
  };
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

interface MarketplaceGridProps {
  walletAddress: string | null;
  selectedRarity: string;
  selectedCategory: string;
  selectedSort: string;
  listedCards?: CardItem[];
  onCardBought?: (card: CardItem) => void;
  onTransactionComplete?: () => void;
}

// Initial mock & IPFS fallback cards for immediate visual presentation matching media_1788014945611.jpg
const INITIAL_CARDS: CardItem[] = [];

export default function MarketplaceGrid({
  walletAddress,
  selectedRarity,
  selectedCategory,
  selectedSort,
  listedCards = [],
  onCardBought,
  onTransactionComplete,
}: MarketplaceGridProps) {
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);

  const { playHover, playClick, playSuccess } = useAudio();

  // Merge forgedCards and listedCards into the displayed list, deduplicating by tokenId
  const allCards = React.useMemo(() => {
    const base = [...cards];
    const existingIds = new Set(base.map((c) => c.tokenId));

    for (const card of listedCards) {
      if (!existingIds.has(card.tokenId)) {
        base.unshift(card); // Show newest listed cards at the top
        existingIds.add(card.tokenId);
      }
    }
    return base;
  }, [cards, listedCards]);

  // Fetch active listings from contract on load if provider is available
  useEffect(() => {
    fetchContractListings();
  }, []);

  const fetchContractListings = async () => {
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
      const mktAddress = (contractsConfig as any).contracts?.GameCardMarketplace?.address || (contractsConfig as any).contracts?.MythicMarketplace?.address || "";
      const mktAbi = (contractsConfig as any).contracts?.GameCardMarketplace?.abi || (contractsConfig as any).contracts?.MythicMarketplace?.abi || [];

      if (!mktAddress || !nftAddress) return;

      const mktContract = new ethers.Contract(mktAddress, mktAbi, provider);
      const nftContract = new ethers.Contract(nftAddress, nftAbi, provider);

      try {
        const listedEvents = await mktContract.queryFilter('CardListed', 0);
        
        // Collect all unique tokens that were ever listed
        const tokenIds = new Set<number>();
        for (const ev of listedEvents) {
          const args = (ev as any).args;
          if (args && args.tokenId) tokenIds.add(Number(args.tokenId));
        }

        const activeListings: any[] = [];
        for (const tid of Array.from(tokenIds)) {
          const listing = await mktContract.getListing(nftAddress, tid);
          if (listing && listing.price > BigInt(0)) {
            activeListings.push({
              tokenId: tid,
              seller: listing.seller,
              priceEth: ethers.formatEther(listing.price),
              listingId: tid
            });
          }
        }

        if (activeListings.length > 0) {
          const fetchedCards: CardItem[] = [];

          for (const item of activeListings) {
            const lId = item.listingId;
            const tId = item.tokenId;
            const seller = item.seller;
            const priceEth = item.priceEth;

            let metadata = {
              name: `FOUNDATION ORACLE CARD #${tId}`,
              description: 'Authentic on-chain forged card.',
              image: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=800&q=80',
              rarity: 'Mythic' as const,
              type: 'FORGED',
              stats: { energy: 99, stability: 99, signal: 99 },
            };

            // 1. Check local storage cache
            if (typeof window !== 'undefined') {
              const localMeta = localStorage.getItem(`card_meta_${tId}`);
              if (localMeta) {
                try {
                  metadata = { ...metadata, ...JSON.parse(localMeta) };
                } catch (e) {}
              }
            }

            // 2. Query tokenURI if needed
            let tokenURI = '';
            try {
              tokenURI = await nftContract.tokenURI(tId);
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
                } catch (err) {}
              }
            }

            fetchedCards.push({
              listingId: lId,
              tokenId: tId,
              name: metadata.name,
              description: metadata.description,
              image: metadata.image,
              rarity: (metadata.rarity as any) || 'Mythic',
              type: metadata.type || 'FORGED',
              price: priceEth,
              seller: seller,
              stats: metadata.stats || { energy: 99, stability: 99, signal: 99 },
            });
          }

          if (fetchedCards.length > 0) {
            setCards([...fetchedCards.reverse()]);
          }
        } else {
          setCards([]);
        }
      } catch (mktErr) {
        console.warn('Contract fetch notice:', mktErr);
      }
    } catch (err) {
      console.warn('Contract connection notice:', err);
    }
  };

  const handleBuyCard = async (card: CardItem) => {
    if (!walletAddress) {
      alert('Please connect your Web3 wallet first to purchase this card.');
      return;
    }

    try {
      playClick();
      setIsBuying(true);
      setBuyingListingId(card.listingId);
      setTxMessage('Initiating Web3 transaction...');

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error('No ethereum provider');

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const nftAddress = (contractsConfig as any).contracts?.GameCardNFT?.address || "";
      const mktAddress = (contractsConfig as any).contracts?.GameCardMarketplace?.address || (contractsConfig as any).contracts?.MythicMarketplace?.address || "";
      const mktAbi = (contractsConfig as any).contracts?.GameCardMarketplace?.abi || (contractsConfig as any).contracts?.MythicMarketplace?.abi || [];

      const mktContract = new ethers.Contract(mktAddress, mktAbi, signer);

      const priceWei = ethers.parseEther(card.price);

      setTxMessage('Awaiting wallet signature & transaction broadcast...');
      const tx = await mktContract.buyItem(nftAddress, card.tokenId, { value: priceWei });
      setTxMessage(`Transaction submitted! Hash: ${tx.hash.substring(0, 12)}...`);

      await tx.wait();
      setTxMessage('Purchase successful! Card transferred to your collection.');
      playSuccess();

      // Record activity provenance for History tab
      addActivity({
        action: 'BOUGHT',
        tokenId: card.tokenId,
        cardName: card.name,
        image: card.image,
        rarity: card.rarity,
        type: card.type,
        price: card.price,
        txHash: tx.hash,
        userAddress: walletAddress,
      });

      // Refresh ETH balance in header
      if (onTransactionComplete) onTransactionComplete();

      // Bug 2 Fix: notify parent so card appears in My Cards
      if (onCardBought) onCardBought({ ...card, seller: walletAddress, price: '0.00' });

      // Remove bought card from marketplace grid
      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.listingId !== card.listingId));
        setSelectedCard(null);
        setIsBuying(false);
        setTxMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error('Buy error:', err);
      const errMsg = err.reason || err.shortMessage || err.message || 'Purchase failed';
      setTxMessage(`Transaction Failed: ${errMsg}`);
      setTimeout(() => {
        setIsBuying(false);
        setBuyingListingId(null);
      }, 3000);
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

  const getRarityBadgeClass = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'mythic': return 'badge-mythic';
      case 'legendary': return 'badge-legendary';
      case 'epic': return 'badge-epic';
      case 'rare': return 'badge-rare';
      default: return 'badge-common';
    }
  };

  // Filter & Sort cards
  const filteredCards = allCards.filter((card) => {
    const matchesRarity = selectedRarity === 'ALL' || card.rarity.toUpperCase() === selectedRarity;
    const matchesCategory = selectedCategory === 'ALL' || card.type.toUpperCase() === selectedCategory;
    const matchesSearch =
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRarity && matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (selectedSort === 'PRICE_ASC') return parseFloat(a.price) - parseFloat(b.price);
    if (selectedSort === 'PRICE_DESC') return parseFloat(b.price) - parseFloat(a.price);
    if (selectedSort === 'RECENT') return b.listingId - a.listingId;
    return 0;
  });

  return (
    <div className="flex-1 space-y-6">
      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="runic-panel p-12 text-center rounded-2xl space-y-3">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
          <h4 className="text-lg font-serif font-bold text-slate-300">No Relics Found</h4>
          <p className="text-xs text-slate-500 font-mono">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCards.map((card) => (
            <div
              key={card.listingId}
              className={`group relative rounded-2xl overflow-hidden bg-obsidian-950/90 border-2 transition-all duration-300 hover:z-10 cursor-pointer ${getRarityBorderClass(
                card.rarity
              )}`}
              style={{ transformStyle: 'preserve-3d' }}
              onMouseEnter={playHover}
              onClick={() => { playClick(); setSelectedCard(card); }}
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
              {/* Card Header & Rarity Badge */}
              <div className="relative h-64 overflow-hidden bg-obsidian-900">
                <img
                  src={card.image}
                  alt={card.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent" />
                
                {/* Rarity & Type Tags */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${getRarityBadgeClass(card.rarity)}`}>
                    {card.rarity}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-obsidian-950/80 border border-slate-700 text-slate-300">
                    {card.type}
                  </span>
                </div>

                {/* Inspect Overlay Trigger */}
                <button
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-obsidian-950/80 text-slate-300 hover:text-slate-100 border border-slate-700 hover:border-accent-cyan transition-all opacity-0 group-hover:opacity-100"
                  title="Inspect Card Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Card Info */}
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xl font-display font-bold text-slate-100 group-hover:text-accent-cyan transition-colors line-clamp-1">
                    <KineticText text={card.name} />
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Stats Bar: ENERGY, STABILITY, SIGNAL */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="stat-energy px-2 py-1.5 rounded-lg text-center">
                    <div className="font-telemetry flex items-center justify-center space-x-1 opacity-90">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>ENERGY</span>
                    </div>
                    <div className="text-xs font-mono font-bold mt-0.5">{card.stats.energy}</div>
                  </div>

                  <div className="stat-stability px-2 py-1.5 rounded-lg text-center">
                    <div className="font-telemetry flex items-center justify-center space-x-1 opacity-90">
                      <Shield className="w-3 h-3 text-blue-400" />
                      <span>STABIL</span>
                    </div>
                    <div className="text-xs font-mono font-bold mt-0.5">{card.stats.stability}</div>
                  </div>

                  <div className="stat-signal px-2 py-1.5 rounded-lg text-center">
                    <div className="font-telemetry flex items-center justify-center space-x-1 opacity-90">
                      <Radio className="w-3 h-3 text-pink-400" />
                      <span>SIGNAL</span>
                    </div>
                    <div className="text-xs font-mono font-bold mt-0.5">{card.stats.signal}</div>
                  </div>
                </div>

                {/* Price & Buy Trigger */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-telemetry text-slate-400">CURRENT PRICE</div>
                    <div className="text-sm font-mono font-bold text-slate-100 flex items-center space-x-1">
                      <span>{card.price} ETH</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleBuyCard(card); }}
                    onMouseEnter={playHover}
                    disabled={isBuying && buyingListingId === card.listingId}
                    className="flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-slate-100 text-obsidian-950 hover:bg-accent-cyan text-obsidian-950 font-bold font-mono text-xs tracking-wider shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{isBuying && buyingListingId === card.listingId ? 'BUYING...' : 'BUY NOW'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Detail View Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl runic-panel rounded-3xl overflow-hidden border-2 border-accent-cyan/50 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => { playClick(); setSelectedCard(null); }}
              onMouseEnter={playHover}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 rounded-full hover:bg-obsidian-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Card Image */}
              <div className="w-full md:w-1/2 relative rounded-2xl overflow-hidden border border-slate-700 bg-obsidian-900">
                <img src={selectedCard.image} alt={selectedCard.name} className="w-full h-72 object-cover" />
                <span className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-mono font-bold ${getRarityBadgeClass(selectedCard.rarity)}`}>
                  {selectedCard.rarity}
                </span>
              </div>

              {/* Card Metadata & Attributes */}
              <div className="w-full md:w-1/2 space-y-4">
                <div>
                  <span className="font-telemetry text-amber-400">{selectedCard.type} • TOKEN #{selectedCard.tokenId}</span>
                  <h3 className="text-2xl font-display text-slate-100">{selectedCard.name}</h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{selectedCard.description}</p>

                {/* Stats Breakdown */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="font-telemetry text-slate-100">Relic Stats</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="stat-energy p-2 rounded-lg text-center">
                      <div className="text-[9px] font-mono">ENERGY</div>
                      <div className="text-sm font-mono font-bold">{selectedCard.stats.energy}</div>
                    </div>
                    <div className="stat-stability p-2 rounded-lg text-center">
                      <div className="text-[9px] font-mono">STABILITY</div>
                      <div className="text-sm font-mono font-bold">{selectedCard.stats.stability}</div>
                    </div>
                    <div className="stat-signal p-2 rounded-lg text-center">
                      <div className="text-[9px] font-mono">SIGNAL</div>
                      <div className="text-sm font-mono font-bold">{selectedCard.stats.signal}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Seller:</span>
                    <span className="text-slate-200">{selectedCard.seller.substring(0, 6)}...{selectedCard.seller.substring(38)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Listing ID:</span>
                    <span className="text-slate-200">#{selectedCard.listingId}</span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-telemetry text-slate-400">PRICE</div>
                    <div className="text-lg font-mono font-bold text-slate-100">{selectedCard.price} ETH</div>
                  </div>
                  <button
                    onClick={() => handleBuyCard(selectedCard)}
                    onMouseEnter={playHover}
                    disabled={isBuying}
                    className="flex items-center space-x-2 py-2.5 px-6 rounded-xl bg-slate-100 text-obsidian-950 hover:bg-accent-cyan text-obsidian-950 font-bold font-mono text-xs tracking-wider shadow-sm hover:brightness-110 active:scale-95 transition-all"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>BUY CARD NOW</span>
                  </button>
                </div>
              </div>
            </div>

            {txMessage && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-300 text-center animate-pulse">
                {txMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
