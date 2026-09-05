'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Header, { TabType } from '@/components/Header';
import Sidebar, { RarityType, CardCategoryType, SortOptionType } from '@/components/Sidebar';
import MarketplaceGrid, { CardItem } from '@/components/MarketplaceGrid';
import CollectionGrid from '@/components/CollectionGrid';
import CardForge from '@/components/CardForge';
import HistoryLog from '@/components/HistoryLog';

// Dynamic import — WebGL Canvas cannot render during SSR
const CosmicVoid = dynamic(() => import('@/components/CosmicVoid'), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('MARKET');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0.0000');

  // Sidebar Filter States
  const [selectedRarity, setSelectedRarity] = useState<RarityType>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<CardCategoryType>('ALL');
  const [selectedSort, setSelectedSort] = useState<SortOptionType>('PRICE_ASC');

  // Collection Stats State
  const [stats, setStats] = useState({
    totalCards: 48,
    onSale: 19,
    owners: 14,
    volumeEth: '14.85',
  });

  // Cards that were forged by the user (shown in My Cards)
  const [mintedCards, setMintedCards] = useState<CardItem[]>([]);

  // Cards that were purchased by the user (shown in My Cards)
  const [purchasedCards, setPurchasedCards] = useState<CardItem[]>([]);

  // Cards the user listed for sale (shown in Market)
  const [listedCards, setListedCards] = useState<CardItem[]>([]);

  // Restore cards and active tab from localStorage on load
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedMinted = localStorage.getItem('mythic_minted_cards');
        if (savedMinted) setMintedCards(JSON.parse(savedMinted));

        const savedPurchased = localStorage.getItem('mythic_purchased_cards');
        if (savedPurchased) setPurchasedCards(JSON.parse(savedPurchased));

        const savedListed = localStorage.getItem('mythic_listed_cards');
        if (savedListed) setListedCards(JSON.parse(savedListed));

        const savedTab = localStorage.getItem('mythic_active_tab') as TabType;
        if (savedTab) setActiveTab(savedTab);
      } catch (e) {}
    }
  }, []);

  // Sync state to localStorage whenever cards change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mythic_minted_cards', JSON.stringify(mintedCards));
    }
  }, [mintedCards]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mythic_purchased_cards', JSON.stringify(purchasedCards));
    }
  }, [purchasedCards]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mythic_listed_cards', JSON.stringify(listedCards));
    }
  }, [listedCards]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mythic_active_tab', tab);
    }
  };

  // When a card is forged, add it to mintedCards and navigate to MY CARDS
  const handleCardMinted = (newCard: CardItem) => {
    setMintedCards((prev) => {
      // Deduplicate by tokenId
      const exists = prev.some((c) => c.tokenId === newCard.tokenId);
      return exists ? prev : [newCard, ...prev];
    });
    setStats((prev) => ({
      ...prev,
      totalCards: prev.totalCards + 1,
    }));
    // Navigate to MY CARDS so user can immediately see their forged card in their collection
    handleTabChange('MY CARDS');
  };

  // When a card is bought, add it to purchasedCards and remove it from listedCards
  const handleCardBought = (boughtCard: CardItem) => {
    setPurchasedCards((prev) => {
      const exists = prev.some((c) => c.tokenId === boughtCard.tokenId);
      return exists ? prev : [...prev, boughtCard];
    });
    setListedCards((prev) => prev.filter((c) => c.tokenId !== boughtCard.tokenId));
  };

  // When a card is listed, add it to listedCards and remove it from personal collection
  const handleCardListed = (listedCard: CardItem) => {
    setListedCards((prev) => {
      const exists = prev.some((c) => c.tokenId === listedCard.tokenId);
      return exists ? prev : [listedCard, ...prev];
    });
    setMintedCards((prev) => prev.filter((c) => c.tokenId !== listedCard.tokenId));
    setPurchasedCards((prev) => prev.filter((c) => c.tokenId !== listedCard.tokenId));
    setStats((prev) => ({
      ...prev,
      onSale: prev.onSale + 1,
    }));
  };

  // ETH Balance Refresh: called after any spend transaction so the header balance stays accurate
  const refreshBalance = async () => {
    if (!walletAddress) return;
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) return;
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(ethereum);
      const balanceWei = await provider.getBalance(walletAddress);
      setWalletBalance(parseFloat(ethers.formatEther(balanceWei)).toFixed(4));
    } catch (e) {
      console.warn('Balance refresh failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-900 text-slate-100 flex flex-col relative">
      {/* WebGL Cosmic Particle Background — z-0, behind everything */}
      <CosmicVoid />

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
        walletBalance={walletBalance}
        setWalletBalance={setWalletBalance}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Marketplace View */}
        {activeTab === 'MARKET' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <Sidebar
              selectedRarity={selectedRarity}
              setSelectedRarity={setSelectedRarity}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedSort={selectedSort}
              setSelectedSort={setSelectedSort}
              onNavigateForge={() => setActiveTab('FORGE')}
              stats={stats}
            />
            <MarketplaceGrid
              walletAddress={walletAddress}
              selectedRarity={selectedRarity}
              selectedCategory={selectedCategory}
              selectedSort={selectedSort}
              listedCards={listedCards}
              onCardBought={handleCardBought}
              onTransactionComplete={refreshBalance}
            />
          </div>
        )}

        {/* My Cards / Inventory View */}
        {activeTab === 'MY CARDS' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <Sidebar
              selectedRarity={selectedRarity}
              setSelectedRarity={setSelectedRarity}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedSort={selectedSort}
              setSelectedSort={setSelectedSort}
              onNavigateForge={() => setActiveTab('FORGE')}
              stats={stats}
            />
            <CollectionGrid
              walletAddress={walletAddress}
              onCardListed={handleCardListed}
              extraCards={[...mintedCards, ...purchasedCards]}
              listedCards={listedCards}
              onTransactionComplete={refreshBalance}
            />
          </div>
        )}

        {/* Relic Creator Studio / Forge View */}
        {activeTab === 'FORGE' && (
          <CardForge walletAddress={walletAddress} onCardMinted={handleCardMinted} onTransactionComplete={refreshBalance} />
        )}

        {/* History Log View */}
        {activeTab === 'HISTORY' && (
          <HistoryLog walletAddress={walletAddress} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-obsidian-950/80 py-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-slate-400 font-serif font-bold">FOUNDATION ORACLE dApp • Web3 Card Trading Platform</div>
          <div>Ethers.js v6 • OpenZeppelin v5 • Next.js App Router</div>
        </div>
      </footer>
    </div>
  );
}
