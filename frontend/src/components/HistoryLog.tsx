'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Coins,
  Hammer,
  CheckCircle2,
} from 'lucide-react';
import { ethers } from 'ethers';
import contractsConfig from '../config/contracts.json';
import { useAudio } from './AudioEngine';
import {
  ActivityItem,
  ActivityAction,
  getStoredActivities,
  saveActivities,
  backfillActivitiesIfEmpty,
} from '../utils/history';

interface HistoryLogProps {
  walletAddress?: string | null;
}

export default function HistoryLog({ walletAddress }: HistoryLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const { playHover, playClick } = useAudio();

  // Load activities from localStorage (and backfill if previously minted/bought cards exist)
  useEffect(() => {
    loadActivities();

    // Listen for real-time updates triggered from Forge or Marketplace
    const handleActivityUpdate = () => {
      loadActivities();
    };
    window.addEventListener('mythic_activity_updated', handleActivityUpdate);

    return () => {
      window.removeEventListener('mythic_activity_updated', handleActivityUpdate);
    };
  }, [walletAddress]);

  const getTimeAgo = (timestampMs: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getProvider = () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
    return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  };

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      // 1. First ensure any previous cards are backfilled so history is never blank
      const localItems = backfillActivitiesIfEmpty();
      let merged: ActivityItem[] = [...localItems];

      // 2. Query on-chain events to sync any transactions directly from smart contracts
      try {
        let provider: ethers.Provider = getProvider();
        try {
          await provider.getBlockNumber();
        } catch (e) {
          provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        }

        const mktAddress =
          (contractsConfig as any).contracts?.GameCardMarketplace?.address ||
          (contractsConfig as any).contracts?.MythicMarketplace?.address ||
          '';
        const mktAbi =
          (contractsConfig as any).contracts?.GameCardMarketplace?.abi ||
          (contractsConfig as any).contracts?.MythicMarketplace?.abi ||
          [];
        const nftAddress =
          (contractsConfig as any).contracts?.GameCardNFT?.address || '';
        const nftAbi =
          (contractsConfig as any).contracts?.GameCardNFT?.abi || [];

        if (mktAddress && nftAddress) {
          const mktContract = new ethers.Contract(mktAddress, mktAbi, provider);
          const nftContract = new ethers.Contract(nftAddress, nftAbi, provider);

          const [soldEvents, mintEvents] = await Promise.all([
            mktContract.queryFilter('CardSold', 0).catch(() => []),
            nftContract.queryFilter('CardMinted', 0).catch(() => []),
          ]);

          const onChainItems: ActivityItem[] = [];

          // Process on-chain Minted events -> FORGED
          for (const ev of mintEvents) {
            const args = (ev as any).args;
            if (!args) continue;
            const recipient = args.recipient;
            const tokenId = Number(args.tokenId);

            // Match current wallet or include if wallet is not connected
            const isUser =
              !walletAddress ||
              (recipient && recipient.toLowerCase() === walletAddress.toLowerCase());

            if (isUser) {
              let cardName = `RELIC #${tokenId}`;
              let cardImg = '';
              let rarity = 'Mythic';
              let type = 'FORGED';

              if (typeof window !== 'undefined') {
                const storedName = localStorage.getItem(`card_name_${tokenId}`);
                if (storedName) cardName = storedName;
                const storedMeta = localStorage.getItem(`card_meta_${tokenId}`);
                if (storedMeta) {
                  try {
                    const parsed = JSON.parse(storedMeta);
                    if (parsed.name) cardName = parsed.name;
                    if (parsed.image) cardImg = parsed.image;
                    if (parsed.rarity) rarity = parsed.rarity;
                    if (parsed.type) type = parsed.type;
                  } catch (e) {}
                }
              }

              let timestamp = Date.now();
              try {
                const block = await provider.getBlock(ev.blockNumber);
                if (block && block.timestamp) timestamp = block.timestamp * 1000;
              } catch (e) {}

              onChainItems.push({
                id: `onchain-mint-${ev.transactionHash}-${tokenId}`,
                action: 'FORGED',
                tokenId,
                cardName,
                image: cardImg,
                rarity,
                type,
                timestamp,
                txHash: ev.transactionHash,
                userAddress: recipient,
              });
            }
          }

          // Process on-chain CardSold events -> BOUGHT or SOLD
          for (const ev of soldEvents) {
            const args = (ev as any).args;
            if (!args) continue;
            const seller = args.seller;
            const buyer = args.buyer;
            const tokenId = Number(args.tokenId);
            const priceEth = args.price ? ethers.formatEther(args.price) : '0.15';

            let timestamp = Date.now();
            try {
              const block = await provider.getBlock(ev.blockNumber);
              if (block && block.timestamp) timestamp = block.timestamp * 1000;
            } catch (e) {}

            let cardName = `TOKEN #${tokenId}`;
            let cardImg = '';
            let rarity = 'Mythic';
            let type = 'CARD';

            if (typeof window !== 'undefined') {
              const storedName = localStorage.getItem(`card_name_${tokenId}`);
              if (storedName) cardName = storedName;
              const storedMeta = localStorage.getItem(`card_meta_${tokenId}`);
              if (storedMeta) {
                try {
                  const parsed = JSON.parse(storedMeta);
                  if (parsed.name) cardName = parsed.name;
                  if (parsed.image) cardImg = parsed.image;
                  if (parsed.rarity) rarity = parsed.rarity;
                  if (parsed.type) type = parsed.type;
                } catch (e) {}
              }
            }

            // Did user BUY it?
            const isBuyer =
              walletAddress && buyer && buyer.toLowerCase() === walletAddress.toLowerCase();
            // Did user SELL it?
            const isSeller =
              walletAddress && seller && seller.toLowerCase() === walletAddress.toLowerCase();

            if (isBuyer) {
              onChainItems.push({
                id: `onchain-bought-${ev.transactionHash}-${tokenId}`,
                action: 'BOUGHT',
                tokenId,
                cardName,
                image: cardImg,
                rarity,
                type,
                price: priceEth,
                timestamp,
                txHash: ev.transactionHash,
                userAddress: buyer,
              });
            } else if (isSeller) {
              onChainItems.push({
                id: `onchain-sold-${ev.transactionHash}-${tokenId}`,
                action: 'SOLD',
                tokenId,
                cardName,
                image: cardImg,
                rarity,
                type,
                price: priceEth,
                timestamp,
                txHash: ev.transactionHash,
                userAddress: seller,
              });
            } else if (!walletAddress) {
              // If no wallet connected, display as SOLD activity
              onChainItems.push({
                id: `onchain-market-${ev.transactionHash}-${tokenId}`,
                action: 'BOUGHT',
                tokenId,
                cardName,
                image: cardImg,
                rarity,
                type,
                price: priceEth,
                timestamp,
                txHash: ev.transactionHash,
                userAddress: buyer,
              });
            }
          }

          // Deduplicate local items and onchain items by txHash or action+tokenId
          const seenKeys = new Set<string>();
          const combined: ActivityItem[] = [];

          // Local items first (they have richer cached metadata like images & custom names)
          for (const item of localItems) {
            const key = item.txHash
              ? item.txHash.toLowerCase()
              : `${item.action}-${item.tokenId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              combined.push(item);
            }
          }

          // Add on-chain items if not already present
          for (const item of onChainItems) {
            const key = item.txHash
              ? item.txHash.toLowerCase()
              : `${item.action}-${item.tokenId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              combined.push(item);
            }
          }

          merged = combined;
        }
      } catch (chainErr) {
        console.warn('On-chain history sync notice:', chainErr);
      }

      // Sort newest activities first
      merged.sort((a, b) => b.timestamp - a.timestamp);
      setActivities(merged);
      saveActivities(merged);
    } catch (err) {
      console.error('History load failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionDisplay = (item: ActivityItem) => {
    switch (item.action) {
      case 'FORGED':
        return {
          title: 'FORGED',
          subtitle: 'Relic Forge Studio',
          icon: <Sparkles className="w-4 h-4 text-purple-300" />,
          badgeClasses:
            'bg-purple-950/60 border border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
          textColor: 'text-purple-400',
          accentBorder: 'border-purple-500/30',
        };
      case 'BOUGHT':
        return {
          title: 'BOUGHT',
          subtitle: item.price ? `${item.price} ETH` : 'Market Purchase',
          icon: <ShoppingBag className="w-4 h-4 text-emerald-300" />,
          badgeClasses:
            'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
          textColor: 'text-emerald-400',
          accentBorder: 'border-emerald-500/30',
        };
      case 'SOLD':
        return {
          title: 'SOLD',
          subtitle: item.price ? `${item.price} ETH` : 'Market Sale',
          icon: <Coins className="w-4 h-4 text-cyan-300" />,
          badgeClasses:
            'bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
          textColor: 'text-cyan-400',
          accentBorder: 'border-cyan-500/30',
        };
    }
  };

  const getRarityBadgeClass = (rarity?: string) => {
    switch (rarity?.toLowerCase()) {
      case 'mythic':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      case 'legendary':
        return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
      case 'epic':
        return 'text-purple-400 border-purple-500/40 bg-purple-500/10';
      case 'rare':
        return 'text-blue-400 border-blue-500/40 bg-blue-500/10';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-800/40';
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (filterAction === 'ALL') return true;
    return act.action === filterAction;
  });

  const countForAction = (act: string) => {
    if (act === 'ALL') return activities.length;
    return activities.filter((a) => a.action === act).length;
  };

  return (
    <div className="flex-1 space-y-6">
      {/* Top Banner & Filter Controls */}
      <div className="runic-panel p-6 sm:p-7 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border-l-4 border-l-accent-cyan">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-accent-cyan font-telemetry text-xs font-bold tracking-wider">
            <History className="w-4 h-4" />
            <span>[ TRANSACTION PROVENANCE ]</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-100">
            RELIC ACTIVITY HISTORY
          </h2>
          <p className="text-xs font-mono text-slate-400">
            Chronological record of cards you have{' '}
            <span className="text-purple-400 font-bold">FORGED</span>,{' '}
            <span className="text-emerald-400 font-bold">BOUGHT</span>, or{' '}
            <span className="text-cyan-400 font-bold">SOLD</span>.
          </p>
        </div>

        {/* Filter Tabs & Refresh */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center space-x-1.5 bg-obsidian-950/80 p-1 rounded-xl border border-slate-800">
            {(['ALL', 'FORGED', 'BOUGHT', 'SOLD'] as const).map((tab) => {
              const isSelected = filterAction === tab;
              const count = countForAction(tab);
              return (
                <button
                  key={tab}
                  onClick={() => {
                    playClick();
                    setFilterAction(tab);
                  }}
                  onMouseEnter={playHover}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-slate-100 text-obsidian-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-obsidian-950 text-slate-100'
                        : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              playClick();
              loadActivities();
            }}
            onMouseEnter={playHover}
            disabled={isLoading}
            className="p-2.5 bg-obsidian-950/80 border border-slate-800 hover:border-accent-cyan text-slate-400 hover:text-accent-cyan rounded-xl transition-all cursor-pointer"
            title="Refresh History Feed"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent-cyan' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* History Log Feed */}
      {isLoading && activities.length === 0 ? (
        <div className="runic-panel p-16 text-center rounded-2xl space-y-3">
          <RefreshCw className="w-8 h-8 text-accent-cyan animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-400">
            Synchronizing activity records & on-chain provenance...
          </div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="runic-panel p-16 text-center rounded-2xl space-y-4 border border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-xl font-display font-bold text-slate-200">
            No {filterAction === 'ALL' ? 'Activity' : filterAction} Records Found
          </h4>
          <p className="text-xs text-slate-400 font-mono max-w-md mx-auto leading-relaxed">
            {filterAction === 'FORGED' &&
              'You have not forged any cards yet. Visit the FORGE studio to craft your first on-chain relic!'}
            {filterAction === 'BOUGHT' &&
              'No card purchases detected yet. Explore the MARKET to acquire powerful relics!'}
            {filterAction === 'SOLD' &&
              'No sales recorded yet. List cards from MY CARDS for other collectors to purchase!'}
            {filterAction === 'ALL' &&
              'Forge cards in the Relic Creator Studio or purchase cards from the Marketplace to populate your history log.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((item) => {
            const display = getActionDisplay(item);
            return (
              <div
                key={item.id}
                className="group runic-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 bg-obsidian-950/80 hover:bg-obsidian-900/90 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* LEFT SIDE: Card Artwork & Card Name */}
                <div className="flex items-center space-x-4 min-w-0">
                  {/* Card Thumbnail */}
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-700/80 bg-obsidian-900 flex-shrink-0 group-hover:border-accent-cyan/60 transition-colors">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.cardName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-obsidian-900 text-slate-600">
                        <Sparkles className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Card Details: Name, Token ID, Rarity, Timestamp */}
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-display font-black text-slate-100 tracking-wide uppercase truncate group-hover:text-accent-cyan transition-colors">
                      {item.cardName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="text-slate-400 font-bold">
                        TOKEN #{item.tokenId}
                      </span>

                      {item.rarity && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getRarityBadgeClass(
                            item.rarity
                          )}`}
                        >
                          {item.rarity}
                        </span>
                      )}

                      {item.type && (
                        <span className="text-slate-500 text-[11px]">
                          • {item.type}
                        </span>
                      )}

                      <span className="text-slate-500 text-[11px]">
                        • {getTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    {item.txHash && (
                      <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
                        <span>TX:</span>
                        <span className="text-slate-400 hover:text-accent-cyan transition-colors">
                          {item.txHash.substring(0, 10)}...{item.txHash.substring(item.txHash.length - 6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: Action Indicator (BOUGHT / SOLD / FORGED) */}
                <div className="flex flex-col sm:items-end items-start self-stretch sm:self-center justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 flex-shrink-0">
                  {/* Prominent Action Pill Badge */}
                  <div
                    className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-black tracking-wider uppercase transition-all ${display.badgeClasses}`}
                  >
                    {display.icon}
                    <span>{display.title}</span>
                  </div>

                  {/* Additional Action Context (e.g. Price or Studio tag) */}
                  <div className="mt-1.5 text-xs font-mono flex items-center space-x-1">
                    {item.action === 'BOUGHT' && item.price && (
                      <span className="text-emerald-400 font-bold">
                        Paid {item.price} ETH
                      </span>
                    )}
                    {item.action === 'SOLD' && item.price && (
                      <span className="text-cyan-400 font-bold">
                        Received {item.price} ETH
                      </span>
                    )}
                    {item.action === 'FORGED' && (
                      <span className="text-purple-400/90 font-medium">
                        Crafted & Minted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
