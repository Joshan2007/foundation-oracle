'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Wallet, ShieldCheck, ChevronDown, LogOut, ArrowLeftRight } from 'lucide-react';
import { ethers } from 'ethers';
import DecryptedText from './DecryptedText';
import KineticText from './KineticText';
import { useAudio } from './AudioEngine';

export type TabType = 'MARKET' | 'FORGE' | 'MY CARDS' | 'HISTORY';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  walletBalance: string;
  setWalletBalance: (balance: string) => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  walletAddress,
  setWalletAddress,
  walletBalance,
  setWalletBalance,
}: HeaderProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkName, setNetworkName] = useState<string>('Not Connected');
  const { isMuted, toggleMute, playHover, playClick } = useAudio();

  const navTabs: TabType[] = ['MARKET', 'FORGE', 'MY CARDS', 'HISTORY'];

  const handleTabChange = (tab: TabType) => {
    playClick();
    setActiveTab(tab);
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined') return;
    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      alert('MetaMask or Web3 wallet non-custodial provider was not detected. Please install MetaMask to interact with FOUNDATION ORACLE.');
      return;
    }

    try {
      playClick();
      setIsConnecting(true);

      // Force MetaMask to display the account picker dialog
      try {
        await ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (permErr: any) {
        if (permErr?.code === 4001) {
          // User rejected/closed the popup
          setIsConnecting(false);
          return;
        }
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);

      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);

        const balanceWei = await provider.getBalance(address);
        const formattedBalance = parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
        setWalletBalance(formattedBalance);

        const network = await provider.getNetwork();
        const cid = Number(network.chainId);
        let netLabel = `Chain ID ${cid}`;
        if (cid === 31337 || cid === 1337) netLabel = 'Localhost (31337)';
        else if (cid === 11155111) netLabel = 'Sepolia';
        else if (cid === 1) netLabel = 'Mainnet';
        setNetworkName(netLabel);
        
        localStorage.removeItem('mythic_wallet_disconnected');
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const switchAccount = async () => {
    if (typeof window === 'undefined') return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert('MetaMask or Web3 wallet was not detected.');
      return;
    }

    try {
      playClick();
      // Forces MetaMask to open account selection dialog
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send('eth_accounts', []);
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        localStorage.removeItem('mythic_wallet_disconnected');

        const balanceWei = await provider.getBalance(address);
        setWalletBalance(parseFloat(ethers.formatEther(balanceWei)).toFixed(4));

        const network = await provider.getNetwork();
        const cid = Number(network.chainId);
        let netLabel = `Chain ID ${cid}`;
        if (cid === 31337 || cid === 1337) netLabel = 'Localhost (31337)';
        else if (cid === 11155111) netLabel = 'Sepolia';
        else if (cid === 1) netLabel = 'Mainnet';
        setNetworkName(netLabel);
      }
    } catch (err: any) {
      if (err?.code !== 4001) {
        console.warn('Account switch error:', err);
      }
    }
  };

  const switchToSepolia = async () => {
    if (typeof window === 'undefined') return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia test network',
                rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com'],
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
        }
      }
    }
  };

  const switchToLocalhost = async () => {
    if (typeof window === 'undefined') return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }], // 31337 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7a69',
                chainName: 'Localhost 8545',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add Localhost network:', addError);
        }
      }
    }
  };

  const disconnectWallet = async () => {
    playClick();
    if (typeof window !== 'undefined') {
      localStorage.setItem('mythic_wallet_disconnected', 'true');
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        try {
          // Attempt to revoke permissions so MetaMask doesn't auto-reconnect to the same account
          await ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (e) {
          // Fallback if wallet doesn't support revokePermissions
        }
      }
    }

    setWalletAddress(null);
    setWalletBalance('0.0000');
    setNetworkName('Not Connected');
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const isDisconnected = localStorage.getItem('mythic_wallet_disconnected') === 'true';
        
        const ethereum = (window as any).ethereum;
        try {
          if (!isDisconnected) {
            const provider = new ethers.BrowserProvider(ethereum);
            const accounts = await provider.send('eth_accounts', []);
            if (accounts && accounts.length > 0) {
              const address = accounts[0];
              setWalletAddress(address);

              const balanceWei = await provider.getBalance(address);
              const formattedBalance = parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
              setWalletBalance(formattedBalance);

              const network = await provider.getNetwork();
              const cid = Number(network.chainId);
              let netLabel = `Chain ID ${cid}`;
              if (cid === 31337 || cid === 1337) netLabel = 'Localhost (31337)';
              else if (cid === 11155111) netLabel = 'Sepolia';
              else if (cid === 1) netLabel = 'Mainnet';
              setNetworkName(netLabel);
            }
          }
        } catch (err) {
          console.error('Auto-connect error:', err);
        }

        ethereum.on?.('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            localStorage.removeItem('mythic_wallet_disconnected');
            // Refresh balance
            const provider = new ethers.BrowserProvider(ethereum);
            provider.getBalance(accounts[0]).then((bal) => {
              setWalletBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
            });
          } else {
            disconnectWallet();
          }
        });

        ethereum.on?.('chainChanged', () => {
          window.location.reload();
        });
      }
    };

    autoConnect();
  }, []);

  return (
    <header className="sticky top-3 sm:top-4 z-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full transition-all duration-300">
      <div className="bg-obsidian-950/75 backdrop-blur-xl border border-white/[0.08] border-t-white/[0.18] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Title */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => handleTabChange('MARKET')}
            onMouseEnter={playHover}
          >
            <div className="relative p-2.5 rounded-xl bg-obsidian-850 border border-slate-700 group-hover:border-accent-cyan transition-all">
              <Compass className="w-8 h-8 text-slate-100 group-hover:text-accent-cyan group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <div>
              <h1 className="text-xl tracking-widest text-slate-100 font-display font-black uppercase">
                <KineticText text="FOUNDATION ORACLE" />
              </h1>
              <p className="text-[10px] text-accent-cyan tracking-widest uppercase font-mono mt-0.5">
                Relic Trading & Forge
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-obsidian-900 p-1.5 rounded-lg border border-slate-800">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  onMouseEnter={playHover}
                  className={`px-4 py-2 text-xs font-mono tracking-widest font-semibold rounded-md transition-all duration-300 ${
                    isActive
                      ? 'bg-slate-100 text-obsidian-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-800'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </nav>

          {/* Right Section: Wallet Connect */}
          <div className="flex items-center space-x-3">
            {walletAddress ? (
              <div className="flex items-center space-x-2 bg-obsidian-900 border border-slate-800 rounded-xl p-1.5 pr-3 shadow-lg">
                <div className="bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan px-2 py-1 rounded-lg text-xs font-mono flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{walletBalance} ETH</span>
                </div>
                <div className="text-right px-2">
                  <div 
                    onClick={switchAccount}
                    className="text-xs font-mono font-bold text-slate-200 tracking-wider hover:text-accent-cyan cursor-pointer transition-colors"
                    title="Click to switch MetaMask account"
                  >
                    {formatAddress(walletAddress)}
                  </div>
                  <div 
                    onClick={
                      networkName.includes('Sepolia') 
                        ? switchToLocalhost 
                        : (networkName.includes('Localhost') ? switchToSepolia : switchToSepolia)
                    }
                    className={`text-[10px] font-mono cursor-pointer transition-colors ${
                      networkName.includes('Sepolia') || networkName.includes('Localhost')
                        ? 'text-emerald-400 hover:text-emerald-300' 
                        : 'text-amber-400 hover:text-amber-300 underline'
                    }`}
                    title={
                      networkName.includes('Sepolia')
                        ? 'Connected to Sepolia (Click to toggle to Localhost)'
                        : (networkName.includes('Localhost') ? 'Connected to Localhost (Click to toggle to Sepolia)' : 'Click to switch to Sepolia')
                    }
                  >
                    ● {networkName}
                  </div>
                </div>
                <button
                  onClick={switchAccount}
                  onMouseEnter={playHover}
                  title="Switch MetaMask Account"
                  className="p-1.5 text-slate-400 hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={disconnectWallet}
                  onMouseEnter={playHover}
                  title="Disconnect / Log Out Wallet"
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                onMouseEnter={playHover}
                disabled={isConnecting}
                className="relative group overflow-hidden px-5 py-2.5 rounded-xl bg-slate-100 text-obsidian-950 font-bold font-mono text-xs tracking-widest hover:bg-accent-cyan hover:shadow-accent-glow transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center space-x-2">
                  <Wallet className="w-4 h-4" />
                  <span>{isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto space-x-2 py-3 border-t border-slate-800 scrollbar-none">
          {navTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 text-[10px] font-mono whitespace-nowrap rounded-lg tracking-widest ${
                activeTab === tab
                  ? 'bg-slate-100 text-obsidian-950 font-bold'
                  : 'text-slate-400 bg-obsidian-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
