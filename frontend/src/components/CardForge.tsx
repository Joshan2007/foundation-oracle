'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Hammer,
  Sparkles,
  Zap,
  Shield,
  Radio,
  CheckCircle2,
  Upload,
  Clipboard,
  X,
} from 'lucide-react';
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

// High-speed client-side image compression: converts device files into crisp, lightweight Data URLs
const compressAndLoadImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (PNG, JPG, JPEG, WEBP, GIF)'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 800;
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Ultra-clean JPEG under 60KB
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(readerEvent.target?.result as string);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export default function CardForge({ walletAddress, onCardMinted, onTransactionComplete }: CardForgeProps) {
  const [name, setName] = useState('AETHERIS THE AWAKENED');
  const [description, setDescription] = useState('Ancient cosmic construct harnessing void energy.');
  const [image, setImage] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileChange = async (file: File) => {
    try {
      setStatusMessage('Optimizing and loading image...');
      const dataUrl = await compressAndLoadImage(file);
      setImage(dataUrl);
      setUploadedFileName(`${file.name} (${Math.round(file.size / 1024)} KB)`);
      setStatusMessage(null);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Image Error: ${err.message || 'Failed to read image'}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Clipboard paste listener: enables instant pasting of screenshots or copied images anywhere in the studio
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            await handleFileChange(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

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

      if (!image) {
        throw new Error('Please select or upload an image from your device before forging.');
      }

      const finalName = name.trim() || 'AETHERIS THE AWAKENED';
      const finalImage = image.trim();
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

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-slate-400 font-bold tracking-widest flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>RELIC ARTWORK (DEVICE UPLOAD)</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  ✓ NO PUBLIC LINK REQUIRED
                </span>
              </div>

              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-accent-cyan bg-accent-cyan/10'
                      : image
                      ? 'border-emerald-500/50 bg-obsidian-950/70'
                      : 'border-slate-800 hover:border-slate-700 bg-obsidian-950/60 hover:bg-obsidian-900/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />

                  {image ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 shadow-md flex-shrink-0">
                        <img src={image} alt="Uploaded preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left space-y-1">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>IMAGE LOADED FROM DEVICE</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                          {uploadedFileName || 'device_image.jpg'}
                        </p>
                        <span className="text-[10px] font-mono text-slate-500 hover:text-accent-cyan underline">
                          Click or drag to replace image
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-obsidian-900 border border-slate-700 flex items-center justify-center text-accent-cyan group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          Click to browse device image
                        </span>
                        <span className="text-xs font-mono text-slate-500"> or drag & drop file here</span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500">
                        PNG, JPG, JPEG, WEBP, GIF • Automatically compressed for instant minting
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Status & Helper Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {uploadedFileName ? (
                    <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[220px]">{uploadedFileName}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImage('');
                          setUploadedFileName(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="ml-1 p-0.5 hover:bg-emerald-500/20 rounded text-emerald-400 hover:text-white transition-colors cursor-pointer"
                        title="Clear image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-500">
                      No image link required. Select any local photo from your device.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator.clipboard && navigator.clipboard.read) {
                          const clipboardItems = await navigator.clipboard.read();
                          for (const item of clipboardItems) {
                            const imageType = item.types.find((t) => t.startsWith('image/'));
                            if (imageType) {
                              const blob = await item.getType(imageType);
                              const file = new File([blob], 'clipboard_image.png', { type: imageType });
                              await handleFileChange(file);
                              return;
                            }
                          }
                        }
                        alert('Tip: Press Ctrl+V anywhere on the page to paste a copied image directly!');
                      } catch (e) {
                        alert('Tip: Press Ctrl+V anywhere on the page to paste a copied image directly!');
                      }
                    }}
                    className="text-[10px] font-mono text-slate-400 hover:text-accent-cyan bg-obsidian-900 hover:bg-obsidian-850 px-3 py-1.5 rounded-lg border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>PASTE CLIPBOARD (Ctrl+V)</span>
                  </button>
                </div>
              </div>
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
                  <span className="text-slate-100 font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-slate-100" /> ENERGY
                  </span>
                  <span className="text-slate-300">{energy} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  className="w-full accent-white bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-100 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-slate-100" /> STABILITY
                  </span>
                  <span className="text-slate-300">{stability} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={stability}
                  onChange={(e) => setStability(Number(e.target.value))}
                  className="w-full accent-white bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-100 font-bold flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-slate-100" /> SIGNAL
                  </span>
                  <span className="text-slate-300">{signal} / 100</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={signal}
                  onChange={(e) => setSignal(Number(e.target.value))}
                  className="w-full accent-white bg-obsidian-900 h-1.5 rounded-lg cursor-pointer"
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
                <div className="flex flex-col items-center justify-center text-slate-600 space-y-2">
                  <Upload className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
                    AWAITING DEVICE IMAGE
                  </span>
                </div>
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

              {/* Asset Origin Indicator */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-obsidian-950/85 border border-slate-700/60 text-[9px] font-mono text-slate-300 backdrop-blur-md">
                <span className={`w-1.5 h-1.5 rounded-full ${image ? 'bg-emerald-400' : 'bg-slate-500'} animate-pulse`} />
                <span>{image ? 'DEVICE IMAGE ATTACHED' : 'AWAITING UPLOAD'}</span>
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
                    <Zap className="w-3 h-3 text-slate-200" />
                    <span className="text-slate-400">ENERGY</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-100">{energy}</div>
                </div>

                <div className="stat-stability bg-obsidian-950/50 border border-slate-800 px-2 py-3 rounded-xl text-center">
                  <div className="font-telemetry flex items-center justify-center space-x-1 mb-1">
                    <Shield className="w-3 h-3 text-slate-200" />
                    <span className="text-slate-400">STABIL</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-100">{stability}</div>
                </div>

                <div className="stat-signal bg-obsidian-950/50 border border-slate-800 px-2 py-3 rounded-xl text-center">
                  <div className="font-telemetry flex items-center justify-center space-x-1 mb-1">
                    <Radio className="w-3 h-3 text-slate-200" />
                    <span className="text-slate-400">SIGNAL</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-slate-100">{signal}</div>
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
