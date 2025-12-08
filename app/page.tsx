"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import toast, { Toaster } from "react-hot-toast";
// WalletConnect is now rendered inside the Header component
import About from "../components/About";
import ImageSwitcher from "../components/ImageSwitcher";
import TiersExplainer from "../components/TiersExplainer";
import Community from "../components/Community";
import VerifyMint from "../components/VerifyMint";

type VerifyResponse = {
  tier: "Oinkless" | "Oinklings" | "Midings" | "Oinklords";
  walletAddress: string;
  balance: number;
  balanceUSD: number;
  minThreshold: number;
  maxThreshold: number | null;
  nftRange: readonly [number, number] | null;
  nftNumber?: number | null;
  verified: boolean;
  message: string;
};

export default function HomePage() {
  const { publicKey, wallet, connected, connect, connecting, disconnecting } = useWallet();
  const readyState = wallet?.readyState;

  // VISUAL DEBUGGER (Bottom Fixed)
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        toast.success("You are back online!");
      } else {
        toast.error("You are offline. Some features may not work.");
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <Toaster position="top-center" />
      <Toaster position="top-center" />

      {/* VISUAL DEBUGGER (Bottom Fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 text-green-400 p-2 text-xs z-[9999] opacity-90 font-mono border-t-2 border-green-500 max-h-[40vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold underline text-green-300">DEBUG CONSOLE</span>
          <button onClick={() => window.location.reload()} className="bg-red-900 text-white px-2 rounded">RELOAD APP</button>
        </div>

        <div className="grid grid-cols-2 gap-x-2 text-[10px]">
          <p>Status: <span className={connected ? "text-green-300" : "text-red-300"}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</span></p>
          <p>Adapter: {wallet?.adapter?.connected ? 'TRUE' : 'FALSE'}</p>
          <p>Ready: {readyState}</p>
          <p>Wallet: {wallet?.adapter?.name || 'None'}</p>
          <p>Mobile: {typeof window !== 'undefined' && /Android|iPhone/i.test(navigator.userAgent) ? 'YES' : 'NO'}</p>
        </div>

        <div className="mt-2 border-t border-gray-700 pt-1">
          <p className="text-yellow-300 break-all">{error ? `ERR: ${error}` : 'No Errors'}</p>
        </div>

        <button
          onClick={async () => {
            try {
              setError("Attempting Forced Connection...");
              if (!wallet) return setError("No wallet selected (Click 'Select Wallet')");

              if (connected) await wallet.adapter.disconnect();

              await wallet.adapter.connect();
              setError("Success: Connected event fired.");
            } catch (e: any) {
              console.error("Manual Connect Error:", e);
              setError(`${e.name}: ${e.message}`);
            }
          }}
          className="mt-2 bg-green-700 text-white px-2 py-3 rounded w-full hover:bg-green-600 font-bold text-sm mb-4"
        >
          FORCE CONNECT (TAP ME)
        </button>
      </div>

      {/* WalletConnect now lives in the Header component */}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white/40 dark:via-white/5 dark:to-white/10" />

      {/* Online/Offline status indicator */}
      {
        !isOnline && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full z-50 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>Offline</span>
            </div>
          </div>
        )
      }

      <section className="px-6 md:px-10 pt-24 md:pt-28 pb-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="relative">
              <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight text-black drop-shadow-title">
                OinkonomicsSol
              </h1>
              <div className="absolute -top-2 -right-4 bg-orange-400 text-black px-3 py-1 rounded-full text-sm font-bold border-2 border-black shadow-hard transform rotate-12">
                DEVNET
              </div>
            </div>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed">
              Enter a world where your crypto wallet defines your status. Scan, get ranked, and mint a unique NFT for your tier.
            </p>
            <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                🔧 <strong>Devnet Collection:</strong> 9JCdYQL53tH97ef7zZBTYWYtLAcWSQVMocs2AjqjD6a4
              </p>
            </div>
            <ul className="text-gray-900 text-base md:text-lg space-y-1">
              <li><span className="font-semibold text-red-600">Oinkless</span>: Less than $10 (No NFT)</li>
              <li><span className="font-semibold text-yellow-600">Oinklings</span>: $10 – $1,000 (NFT #1-100)</li>
              <li><span className="font-semibold text-blue-600">Midings</span>: $1,000 – $10,000 (NFT #100-200)</li>
              <li><span className="font-semibold text-purple-600">Oinklords</span>: $10,000+ (NFT #200-300)</li>
            </ul>

            {/* Replaced legacy Scan button with VerifyMint component */}
            <div className="pt-2">
              <VerifyMint />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="relative h-[300px] md:h-[420px]">
            <div className="absolute inset-0 rounded-[28px] border-4 border-black bg-gradient-to-tr from-pink-200 via-yellow-200 to-sky-200 shadow-hard overflow-hidden tilt animate-scan">
              <ImageSwitcher
                images={[
                  "https://i.ibb.co/jXKRxQz/WizardHS.jpg",
                  "https://i.ibb.co/0yDNJ3D9/Rich-Chain-Pig.jpg",
                  "https://i.ibb.co/7xH0KMDq/Rich-Crown-Guy.jpg",
                  "https://i.ibb.co/2rWvjBH/Poor-Worker1.jpg",
                  "https://i.ibb.co/ymVmV4cb/Poor-Beaten-Up1.jpg",
                ]}
                intervalMs={2500}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.5),transparent_40%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10 overflow-hidden">
                <div className="h-full w-1/3 bg-black/60 animate-marquee" />
              </div>
            </div>

            <div className="absolute -top-4 -left-4 w-16 h-16 bg-yellow-300 rounded-full border-2 border-black shadow-hard animate-float" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-pink-300 rounded-2xl border-2 border-black shadow-hard animate-float-delayed" />
            <div className="absolute top-8 -right-3 w-10 h-10 bg-sky-300 rounded-lg border-2 border-black shadow-hard animate-float-slow" />
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-6">
          {[
            { t: "Oinkless", d: "😱 HOW ARE YOU THAT OINKLESS?! Get at least $10!", c: "from-red-300 to-red-200", nft: "No NFT" },
            { t: "Oinklings", d: "Playful, gritty, and hungry for more. Mint NFT #1-100", c: "from-rose-200 to-amber-100", nft: "#1-100" },
            { t: "Midings", d: "Balanced, confident, and on the rise. Mint NFT #100-200", c: "from-sky-200 to-emerald-100", nft: "#100-200" },
            { t: "Oinklords", d: "Bold, radiant, and unmistakable. Mint NFT #200-300", c: "from-fuchsia-200 to-cyan-100", nft: "#200-300" },
          ].map((x) => (
            <div key={x.t} className={`rounded-3xl border-2 border-black p-6 bg-gradient-to-br ${x.c} shadow-hard tilt transition-transform`}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">{x.t}</h3>
                <span className="text-xs uppercase tracking-widest">Tier</span>
              </div>
              <div className="mt-2 text-sm font-bold text-purple-700">NFT Range: {x.nft}</div>
              <p className="mt-3 text-gray-800">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed explainer section */}
      <TiersExplainer />

      {/* Community CTA */}
      <Community />

      <section className="px-6 md:px-10 pb-24">
        <div className="max-w-5xl mx-auto">
          <About />
          <p className="text-center text-xs text-gray-400 mt-12 font-mono">v2.0 - Oinklords Edition 🐷</p>
        </div>
      </section>
    </main >
  );
}

