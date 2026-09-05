import type { Metadata } from 'next';
import './globals.css';
import { AudioEngineProvider } from '../components/AudioEngine';

export const metadata: Metadata = {
  title: 'FOUNDATION ORACLE | Web3 NFT Marketplace & Card Reliquary',
  description: 'Trade, Forge, and Discover Mythic Relics on Ethereum',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian-900 text-slate-100 min-h-screen selection:bg-accent-cyan selection:text-obsidian-950">
        <AudioEngineProvider>
          {children}
        </AudioEngineProvider>
      </body>
    </html>
  );
}
