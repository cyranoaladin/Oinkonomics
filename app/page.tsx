"use client";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import toast, { Toaster } from "react-hot-toast";
// WalletConnect is now rendered inside the Header component
import About from "../components/About";
import ImageSwitcher from "../components/ImageSwitcher";
import TiersExplainer from "../components/TiersExplainer";
import Community from "../components/Community";
import { mintNFT } from "../lib/utils";

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
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // DEBUGGER STATE
  const [showDebug, setShowDebug] = useState(false);

  const walletAddress = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);

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

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleScan = useCallback(async () => {
    // Check if online
    if (!navigator.onLine) {
      toast.error("You are offline. Please check your connection.");
      return;
    }

    let finalWalletAddress = walletAddress;

    if (!finalWalletAddress) {
      // If not connected, try to trigger the wallet connect flow (useful when user clicks Scan)
      if (typeof connect === 'function') {
        try {
          await connect();
        } catch (e) {
          toast.error('Failed to connect wallet');
          return;
        }
      }

      // Try to read public key from the adapter after connect
      finalWalletAddress = wallet?.adapter?.publicKey?.toBase58() ?? null;
    }

    if (!finalWalletAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    const t = toast.loading("Scanning your wallet…");
    try {
      const res = await fetch("/api/verify-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: finalWalletAddress }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Too many requests. Please try again later.");
        } else {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Failed to verify tier");
        }
        return;
      }

      const j: VerifyResponse = await res.json();
      setData(j);
      toast.success(`You are ${j.tier} • $${j.balanceUSD.toLocaleString()}`);
    } catch (e: any) {
      console.error('Scan error:', e);
      const msg = e?.message || "Scan failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      toast.dismiss(t);
    }
  }, [walletAddress, connect, wallet]);

  const handleMint = useCallback(async () => {
    if (!wallet?.adapter || !data) return;

    // Check if online
    if (!navigator.onLine) {
      toast.error("You are offline. Minting requires an internet connection.");
      return;
    }

    // Empêcher le mint pour Oinkless
    if (data.tier === "Oinkless") {
      toast.error("😱 You need at least $10 to mint! Come back when you're less Oinkless!");
      return;
    }

    // Définir les Candy Machine IDs par tier (using different CMs per tier)
    // Note: These would be different CMs in production, using the same for now as placeholders
    const candyMachineIds = {
      Oinkless: "", // Pas de mint possible
      Oinklings: "8HTSVL3fNTg8CugR8veRGVEyLhz5CBbkW2T4m54zdTAn", // Oinkling candies
      Midings: "8HTSVL3fNTg8CugR8veRGVEyLhz5CBbkW2T4m54zdTAn",  // Miding candies
      Oinklords: "8HTSVL3fNTg8CugR8veRGVEyLhz5CBbkW2T4m54zdTAn"  // Oinklord candies
    };

    // In a real implementation, you would want to have different CMs for each tier
    // For now, we'll add a comment about this and implement some basic validation
    if (candyMachineIds[data.tier] === "") {
      toast.error("Minting not available for this tier");
      return;
    }

    setMinting(true);
    const t = toast.loading(`Minting NFT #${data.nftNumber}…`);

    try {
      const candyMachineId = candyMachineIds[data.tier];
      console.log('🎯 Tentative de mint:', { tier: data.tier, nftNumber: data.nftNumber, candyMachineId });

      const res = await mintNFT(wallet.adapter, candyMachineId);

      if (res.success) {
        toast.success(res.message || `🎉 NFT #${data.nftNumber} minté avec succès !`);
        console.log('✅ Mint réussi:', res);
      } else {
        throw new Error(res.error || 'Échec du mint');
      }
    } catch (e: any) {
      console.error('❌ Erreur mint:', e);
      toast.error(`❌ Échec du mint: ${e?.message || "Erreur inconnue"}`);
    } finally {
      setMinting(false);
      toast.dismiss(t);
    }
  }, [wallet?.adapter, data]);

  const tierStyle = useMemo(() => {
    if (!data?.tier) return "";
    if (data.tier === "Oinkless") return "from-red-400 to-red-600";
    if (data.tier === "Oinklings") return "from-rose-300 to-amber-200";
    if (data.tier === "Midings") return "from-sky-300 to-emerald-200";
    return "from-fuchsia-300 to-cyan-200";
  }, [data?.tier]);

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
      {!isOnline && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full z-50 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Offline</span>
          </div>
        </div>
      )}

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

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleScan}
                disabled={loading || !isOnline}
                className="relative btn-primary group disabled:opacity-60 min-w-[180px]"
              >
                <span className="relative z-10">
                  {loading ? "Scanning…" : connected ? "Scan my wallet" : "Connect & Scan"}
                </span>
                <span className="btn-shine" />
                {!connected && (
                  <div className="absolute -right-2 -top-2 w-4 h-4 bg-green-400 rounded-full animate-ping" />
                )}
              </button>

              {data && (
                <div className={`inline-flex items-center gap-3 rounded-2xl border-2 border-black px-4 py-3 bg-gradient-to-r ${tierStyle} shadow-hard tilt animate-float`}>
                  <span className="text-sm font-semibold tracking-widest uppercase">{data.tier}</span>
                  <span className="text-sm text-black/80">${data.balanceUSD.toLocaleString()}</span>
                </div>
              )}
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
              {data?.tier && data.tier === x.t && (
                <button
                  onClick={handleMint}
                  disabled={minting || data.tier === "Oinkless"}
                  className={`mt-5 ${data.tier === "Oinkless" ? "btn-disabled" : "btn-dark"}`}
                >
                  {data.tier === "Oinkless"
                    ? "❌ NO MINT FOR YOU!"
                    : minting ? "Minting…" : `Mint NFT #${data.nftNumber}`
                  }
                </button>
              )}
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
    </main>
  );
}

