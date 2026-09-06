'use client';

import React from 'react';
import { Filter, Layers, ArrowUpDown } from 'lucide-react';
import { TabType } from './Header';
import { useAudio } from './AudioEngine';

export type RarityType = 'ALL' | 'MYTHIC' | 'LEGENDARY' | 'EPIC' | 'RARE' | 'COMMON';
export type CardCategoryType = 'ALL' | 'ARTIFACT' | 'RELIC' | 'SPELL' | 'CREATURE' | 'WEAPON' | 'SENTINEL';
export type SortOptionType = 'PRICE_ASC' | 'PRICE_DESC' | 'RECENT' | 'RARITY';

interface SidebarProps {
  selectedRarity: RarityType;
  setSelectedRarity: (rarity: RarityType) => void;
  selectedCategory: CardCategoryType;
  setSelectedCategory: (category: CardCategoryType) => void;
  selectedSort: SortOptionType;
  setSelectedSort: (sort: SortOptionType) => void;
  onNavigateForge?: () => void;
  stats?: {
    totalCards: number;
    onSale: number;
    owners: number;
    volumeEth: string;
  };
}

export default function Sidebar({
  selectedRarity,
  setSelectedRarity,
  selectedCategory,
  setSelectedCategory,
  selectedSort,
  setSelectedSort,
  stats = { totalCards: 48, onSale: 19, owners: 14, volumeEth: '14.85' },
}: SidebarProps) {
  const { playHover, playClick } = useAudio();

  const rarities: { id: RarityType; label: string; color: string }[] = [
    { id: 'ALL', label: 'ALL RARITIES', color: 'text-slate-300 border-slate-700 hover:border-slate-500' },
    { id: 'MYTHIC', label: 'MYTHIC', color: 'text-purple-400 border-purple-500/40 hover:border-purple-400' },
    { id: 'LEGENDARY', label: 'LEGENDARY', color: 'text-accent-cyan border-amber-500/40 hover:border-amber-400' },
    { id: 'EPIC', label: 'EPIC', color: 'text-indigo-400 border-indigo-500/40 hover:border-indigo-400' },
    { id: 'RARE', label: 'RARE', color: 'text-cyan-400 border-cyan-500/40 hover:border-cyan-400' },
    { id: 'COMMON', label: 'COMMON', color: 'text-slate-400 border-slate-500/40 hover:border-slate-300' },
  ];

  const categories: CardCategoryType[] = ['ALL', 'ARTIFACT', 'RELIC', 'SPELL', 'CREATURE', 'WEAPON', 'SENTINEL'];

  return (
    <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
      {/* Rarity Filter Widget */}
      <div className="runic-panel p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 font-telemetry text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>[ 01 // RARITY FILTER ]</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {rarities.map((item) => {
            const isSelected = selectedRarity === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { playClick(); setSelectedRarity(item.id); }}
                onMouseEnter={playHover}
                className={`py-2 px-3 rounded-xl text-[10px] font-mono font-bold tracking-widest border transition-all text-center ${
                  isSelected
                    ? `bg-white/[0.1] ${item.color} shadow-lg ring-1 ring-accent-cyan/50 backdrop-blur-sm`
                    : `bg-white/[0.03] ${item.color} opacity-70 hover:opacity-100 hover:bg-white/[0.06]`
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type Dropdown */}
      <div className="runic-panel p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 font-telemetry text-slate-400">
          <Layers className="w-3.5 h-3.5" />
          <span>[ 02 // CARD TYPE ]</span>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as CardCategoryType)}
          onMouseEnter={playHover}
          className="w-full bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] text-slate-200 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer mt-2"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat} className="bg-obsidian-950 text-slate-200">
              {cat === 'ALL' ? 'All Card Types' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Sort Dropdown */}
      <div className="runic-panel p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 font-telemetry text-slate-400">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>[ 03 // SORT ORDER ]</span>
        </div>
        <select
          value={selectedSort}
          onChange={(e) => setSelectedSort(e.target.value as SortOptionType)}
          onMouseEnter={playHover}
          className="w-full bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] text-slate-200 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer mt-2"
        >
          <option value="PRICE_ASC" className="bg-obsidian-950">Price: Low to High</option>
          <option value="PRICE_DESC" className="bg-obsidian-950">Price: High to Low</option>
          <option value="RECENT" className="bg-obsidian-950">Recently Listed</option>
          <option value="RARITY" className="bg-obsidian-950">Rarity Tier</option>
        </select>
      </div>
    </aside>
  );
}
