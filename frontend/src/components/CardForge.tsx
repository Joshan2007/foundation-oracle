'use client';

import React, { useState } from 'react';
import { Hammer, Sparkles, Zap, Shield, Radio, CheckCircle2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { CardItem } from './MarketplaceGrid';
import contractsConfig from '../config/contracts.json';
import DecryptedText from './DecryptedText';
import KineticText from './KineticText';
import { useAudio } from './AudioEngine';
import { addActivity } from '../utils/history';

interface CardForgeProps {
  walletAddress: string | null;
  onCardMinted?: (newCard: CardItem) => void;
  onTransactionComplete?: () => void;
}

const PRESET_ARTWORKS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
];

export default function CardForge({ walletAddress, onCardMinted, onTransactionComplete }: CardForgeProps) {
  const [name, setName] = useState('AETHERIS THE AWAKENED');
  const [description, setDescription] = useState('Ancient cosmic construct harnessing void energy.');
  const [image, setImage] = useState(PRESET_ARTWORKS[0]);
  const [rarity, setRarity] = useState<'Mythic' | 'Legendary' | 'Epic' | 'Rare' | 'Common'>('Mythic');
  const [type, setType] = useState('SENTINEL');
  const [energy, setEnergy] = useState(50);
  const [stability, setStability] = useState(50);
  const [signal, setSignal] = useState(50);

  const [isMinting, setIsMinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mintedResult, setMintedResult] = useState<{ tokenId: number; ipfsUri: string } | null>(null);

  const { playHover, playClick, playSuccess } = useAudio();

  const getRarityBadgeClass = (r: string) => {
    switch (r.toLowerCase()) {
      case 'mythic': return 'badge-mythic';
      case 'legendary': return 'badge-legendary';
      case 'epic': return 'badge-epic';
      case 'rare': return 'badge-rare';
      default: return 'badge-common';
    }
  };

  const getRarityBorderClass = (r: string) => {
    switch (r.toLowerCase()) {
      case 'mythic': return 'border-rarity-mythic';
      case 'legendary': return 'border-rarity-legendary';
      case 'epic': return 'border-rarity-epic';
      case 'rare': return 'border-rarity-rare';
      default: return 'border-rarity-common';
    }
  };

  const handleForgeCard = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      playClick();
      setIsMinting(true);
      setMintedResult(null);

      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask is not installed. Please install MetaMask to forge cards.");
      }

      const provider = new ethers.BrowserProvider(ethereum);

      // 1. Auto-connect if walletAddress is not set yet
      let activeAddress = walletAddress;
      if (!activeAddress) {
        setStatusMessage('Connecting MetaMask wallet...');
        const accounts = await provider.send('eth_requestAccounts', []);
        if (!accounts || accounts.length === 0) {
          throw new Error('Please connect your MetaMask wallet to forge.');
        }
        activeAddress = accounts[0];
      }

      // 2. Network Check: Support Sepolia (11155111) and Localhost (31337 / 1337)
      try {
        const network = await provider.getNetwork();
        const cid = Number(network.chainId);
        // If user is on Sepolia or Localhost, stay on the current network without switching!
        if (cid !== 11155111 && cid !== 31337 && cid !== 1337) {
          setStatusMessage('Switching network to Sepolia...');
          try {
            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }], // Sepolia (11155111)
            });
          } catch (switchErr: any) {
            if (switchErr.code === 4902) {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xaa36a7',
                  chainName: 'Sepolia test network',
                  rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com'],
                  nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }],
              });
            }
          }
        }
      } catch (netErr) {
        console.warn('Network check notice:', netErr);
      }

      const finalName = name.trim() || 'AETHERIS THE AWAKENED';
      const finalImage = image.trim() || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
      const finalDesc = description.trim() || 'Ancient cosmic construct harnessing void energy.';

      setStatusMessage('Step 1/3: Pinning card metadata to IPFS...');

      const pinResponse = await fetch('/api/ipfs/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          description: finalDesc,
          image: finalImage,
          rarity,
          type,
          stats: { energy, stability, signal },
        }),
      });

      const pinData = await pinResponse.json();
      if (!pinData.success) throw new Error(pinData.error || 'IPFS Pinning failed');

      const ipfsUri = pinData.ipfsUri;
      setStatusMessage(`Step 2/3: Metadata pinned (${pinData.ipfsHash.substring(0, 10)}...). Broadcasting on-chain mint transaction...`);

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const recipientAddress = signerAddress || activeAddress || "";

      const nftAddress = (contractsConfig as any).contracts?.GameCardNFT?.address || (contractsConfig as any).GameCardNFT?.address || "";
      const nftAbi = (contractsConfig as any).contracts?.GameCardNFT?.abi || (contractsConfig as any).GameCardNFT?.abi || [];

      if (!nftAddress) {
        throw new Error('GameCardNFT smart contract address not found in configuration.');
      }

      const nftContract = new ethers.Contract(nftAddress, nftAbi, signer);
      
      // Explicit gas limit guarantees MetaMask estimation never fails
      const tx = await nftContract.mintCard(recipientAddress, ipfsUri, { gasLimit: 500000 });
      
      setStatusMessage(`Step 3/3: Transaction broadcasted (${tx.hash.substring(0, 12)}...). Confirming block...`);
      const receipt = await tx.wait();

      let newTokenId = Math.floor(1000 + Math.random() * 9000);
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsed = nftContract.interface.parseLog(log);
            if (parsed && (parsed.name === 'CardMinted' || parsed.name === 'Transfer') && parsed.args && parsed.args.tokenId) {
              newTokenId = Number(parsed.args.tokenId);
              break;
            }
          } catch (logErr) {}
        }
      }

      setStatusMessage('Card successfully forged and minted on-chain!');
      setMintedResult({ tokenId: newTokenId, ipfsUri });
      playSuccess();

      if (onTransactionComplete) onTransactionComplete();

      const forgedCard: CardItem = {
        listingId: 0,
        tokenId: newTokenId,
        name: finalName,
        description: finalDesc,
        image: finalImage,
        rarity,
        type,
        price: '0.00',
        seller: recipientAddress,
        stats: { energy, stability, signal },
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`card_name_${newTokenId}`, finalName);
        localStorage.setItem(`card_meta_${newTokenId}`, JSON.stringify(forgedCard));
      }

      // Record activity provenance for History tab
      addActivity({
        action: 'FORGED',
        tokenId: newTokenId,
        cardName: finalName,
        image: finalImage,
        rarity,
        type,
        txHash: tx.hash,
        userAddress: recipientAddress,
      });

      if (onCardMinted) onCardMinted(forgedCard);
      
    } catch (err: any) {
      console.error('Forge error:', err);
      const errMsg = err.reason || err.shortMessage || err.message || 'Minting failed';
      setStatusMessage(`Forge Error: ${errMsg}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="flex-1 space-y-8">
      {/* Studio Banner */}
      <div className="runic-panel p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-accent-cyan">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-accent-cyan font-telemetry mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>[ RELIC CREATOR STUDIO ]</span>
          </div>
          <h2 className="text-3xl font-display font-black text-slate-100">
            <KineticText text="FORGE ON-CHAIN RELIC" />
          </h2>
        </div>
        <div className="px-4 py-2 bg-obsidian-900 border border-slate-700/50 rounded-lg text-[10px] font-mono text-slate-400 tracking-widest">
          IPFS METADATA PINNING
        </div>
      </div>

      {mintedResult && (
        <div className="p-5 runic-panel rounded-2xl space-y-2 border border-emerald-500/30 text-emerald-400 text-sm font-mono">
          <div className="flex items-center space-x-2 font-bold mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>RELIC FORGED SUCCESSFULLY!</span>
          </div>
          <div className="text-slate-300">TOKEN ID: <span className="text-emerald-400">#{mintedResult.tokenId}</span></div>
          <div className="text-slate-300 truncate">IPFS URI: <span className="text-emerald-400">{mintedResult.ipfsUri}</span></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Creation Form */}
        <form onSubmit={handleForgeCard} className="lg:col-span-7 runic-panel p-6 sm:p-10 rounded-2xl space-y-10">
          
          <div className="space-y-6">
            <h3 className="font-telemetry text-accent-cyan border-b border-slate-800 pb-3">
              [ 01 // CORE IDENTITY ]
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">RELIC DESIGNATION</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-800 text-slate-100 text-sm font-mono rounded-xl px-4 py-3.5 focus:outline-none focus:border-accent-cyan transition-colors"
                placeholder="e.g. AETHERIS THE AWAKENED"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">LORE / DESCRIPTION</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-800 text-slate-100 text-sm font-mono rounded-xl px-4 py-3.5 focus:outline-none focus:border-accent-cyan transition-colors"
                placeholder="Enter cryptographic lore or attributes..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">ASSET URL</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = PRESET_ARTWORKS[(PRESET_ARTWORKS.indexOf(image) + 1) % PRESET_ARTWORKS.length];
                    setImage(next);
                  }}
                  className="text-[10px] font-mono text-accent-cyan hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> CYCLE ARTWORK
                </button>
              </div>
              <input
                type="text"
                required
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-800 text-slate-100 text-sm font-mono rounded-xl px-4 py-3.5 focus:outline-none focus:border-accent-cyan transition-colors"
                placeholder="https://"
              />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-telemetry text-accent-cyan border-b border-slate-800 pb-3">
              [ 02 // CLASSIFICATION ]
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">RARITY TIER</label>
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as any)}
                  className="w-full bg-obsidian-900 border border-slate-800 text-slate-100 text-sm font-mono rounded-xl px-4 py-3.5 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
                >
                  <option value="Mythic">Mythic</option>
                  <option value="Legendary">Legendary</option>
                  <option value="Epic">Epic</option>
                  <option value="Rare">Rare</option>
                  <option value="Common">Common</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">CLASS</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-obsidian-900 border border-slate-800 text-slate-100 text-sm font-mono rounded-xl px-4 py-3.5 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
                >
                  <option value="SENTINEL">SENTINEL</option>
                  <option value="RELIC">RELIC</option>
                  <option value="ARTIFACT">ARTIFACT</option>
                  <option value="SPELL">SPELL</option>
                  <option value="CREATURE">CREATURE</option>
                  <option value="WEAPON">WEAPON</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-telemetry text-accent-cyan border-b border-slate-800 pb-3">
              [ 03 // METRICS ]
            </h3>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-accent-cyan font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> ENERGY
                  </span>
                  <span className="text-slate-300">{energy} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  className="w-full accent-accent-cyan bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-accent-blue font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> STABILITY
                  </span>
                  <span className="text-slate-300">{stability} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={stability}
                  onChange={(e) => setStability(Number(e.target.value))}
                  className="w-full accent-accent-blue bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-pink-400 font-bold flex items-center gap-1.5">
                    <Radio className="w-4 h-4" /> SIGNAL
                  </span>
                  <span className="text-slate-300">{signal} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={signal}
                  onChange={(e) => setSignal(Number(e.target.value))}
                  className="w-full accent-pink-500 bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isMinting}
            onMouseEnter={playHover}
            className="w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl bg-slate-100 text-obsidian-950 font-bold font-mono text-sm tracking-widest hover:bg-accent-cyan active:scale-95 transition-all disabled:opacity-50 mt-4 cursor-pointer"
          >
            <Hammer className="w-4 h-4" />
            <span>{isMinting ? 'INITIALIZING FORGE SEQUENCE...' : 'EXECUTE FORGE'}</span>
          </button>

          {statusMessage && (
            <div className="p-4 bg-obsidian-900 border border-slate-700 rounded-xl font-telemetry text-accent-cyan text-center animate-pulse">
              {statusMessage}
            </div>
          )}
        </form>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="font-telemetry text-slate-400 text-center mt-2">
            [ LIVE FORGE PREVIEW ]
          </h3>

          <div className={`relative rounded-2xl overflow-hidden bg-obsidian-900 border-2 transition-all duration-500 ${getRarityBorderClass(rarity)} shadow-2xl`}>
            {/* Asset Header */}
            <div className="relative h-72 overflow-hidden bg-obsidian-950 flex items-center justify-center border-b border-slate-800">
              {image ? (
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-16 h-16 text-slate-800" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian-900 via-transparent to-transparent" />
              
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border border-slate-700/50 bg-obsidian-950/80 backdrop-blur-md ${getRarityBadgeClass(rarity)}`}>
                  {rarity}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-obsidian-950/80 backdrop-blur-md border border-slate-700/50 text-slate-300 uppercase">
                  {type}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-2xl font-display font-bold text-slate-100 line-clamp-1">
                  {name || 'UNNAMED RELIC'}
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed h-10 overflow-hidden line-clamp-2">
                  {description || 'Awaiting cryptographic lore input...'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="stat-energy bg-obsidian-950/50 border border-slate-800 px-2 py-3 rounded-xl text-center">
                  <div className="font-telemetry flex items-center justify-center space-x-1 mb-1">
                    <Zap className="w-3 h-3 text-accent-cyan" />
                    <span className="text-slate-400">ENERGY</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-accent-cyan">{energy}</div>
                </div>

                <div className="stat-stability bg-obsidian-950/50 border border-slate-800 px-2 py-3 rounded-xl text-center">
                  <div className="font-telemetry flex items-center justify-center space-x-1 mb-1">
                    <Shield className="w-3 h-3 text-accent-blue" />
                    <span className="text-slate-400">STABIL</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-accent-blue">{stability}</div>
                </div>

                <div className="stat-signal bg-obsidian-950/50 border border-slate-800 px-2 py-3 rounded-xl text-center">
                  <div className="font-telemetry flex items-center justify-center space-x-1 mb-1">
                    <Radio className="w-3 h-3 text-pink-400" />
                    <span className="text-slate-400">SIGNAL</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-pink-400">{signal}</div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-800 font-telemetry text-slate-500 flex justify-between">
                <span>ORACLE FORGE v2.0</span>
                <span>STATUS: PENDING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
