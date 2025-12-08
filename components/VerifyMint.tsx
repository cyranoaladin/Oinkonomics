"use client";
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "react-hot-toast";

import bs58 from 'bs58';

type Status = "idle" | "loading" | "verified" | "error";
type Tier = "Oinkless" | "Oinklings" | "Midings" | "Oinklords";

interface TierInfo {
  tier: Tier;
  balance: number;
  balanceUSD: number;
  minThreshold: number;
  maxThreshold: number | null;
  nftRange: readonly [number, number] | null;
  nftNumber?: number | null;
  verified: boolean;
  message: string;
  candyMachineId?: string;
}

const VerifyMint: React.FC = () => {
  const { connected, publicKey, wallet } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* 
   * NEW SECURE FLOW:
   * 1. Request Challenge (Nonce)
   * 2. Sign Challenge
   * 3. Verify on Backend
   * 4. Get Verified Tier (Server-Side)
   */
  const handleVerify = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    const adapter = wallet?.adapter as any;
    if (!adapter?.signMessage) {
      toast.error("Wallet does not support message signing! (Are you using a Ledger?)");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    const loadToast = toast.loading("Verifying Identity...");

    try {
      // 1. Get Nonce
      const nonceRes = await fetch('/api/auth/nonce', { cache: 'no-store' });
      if (!nonceRes.ok) throw new Error('Failed to fetch Secure Nonce');
      const { message, nonce } = await nonceRes.json();

      // 2. Client Signing (The User Action)
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await adapter.signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      toast.loading("Verifying with Server...", { id: loadToast });

      // 3. Verify Signature
      const authRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(), // Still send public key for check
          message,
          signature
        })
      });

      if (!authRes.ok) {
        const err = await authRes.json();
        throw new Error(err.message || 'Signature verification failed');
      }

      toast.loading("Calculating Wealth Tier...", { id: loadToast });

      // 4. Get Authoritative Tier (Secure Context)
      const tierRes = await fetch("/api/tiers/current");

      if (!tierRes.ok) {
        if (tierRes.status === 401) throw new Error("Session invalid. Please verification again.");
        throw new Error("Failed to fetch verified tier");
      }

      const tierData = await tierRes.json();

      if (!tierData.success) {
        throw new Error(tierData.error || "Unknown Tier Error");
      }

      // Success!
      setTierInfo(tierData.data);
      setStatus("verified");
      toast.success(`${tierData.data.tier} Verified!`, { id: loadToast });

    } catch (error) {
      console.error("Verification error:", error);
      const message = error instanceof Error ? error.message : "Verification failed";

      if (message.includes("User rejected")) {
        toast.error("Signature rejected.", { id: loadToast });
      } else {
        toast.error(message, { id: loadToast });
      }
      setErrorMessage(message);
      setStatus("error");
    }
  };

  /*
   * NEW MINT FLOW:
   * 1. Init Mint on Server (Checks tier, creates mint keypair, signs it, sets budget)
   * 2. Receive Partial Transaction
   * 3. User Signs (Fee Payer)
   * 4. Broadcast
   */
  const handleMint = async () => {
    if (!wallet?.adapter || !tierInfo) {
      toast.error("Wallet or tier info not available");
      return;
    }

    if (tierInfo.tier === "Oinkless") {
      toast.error("😱 You need at least $10 to mint! Come back when you're less poor!");
      return;
    }

    setStatus("loading");
    const loadToast = toast.loading(`Initializing Mint for ${tierInfo.tier}...`);

    try {
      // 1. Initialize on Backend
      const initRes = await fetch('/api/mint/init', {
        method: 'POST'
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'Failed to initialize mint');
      }

      const { transaction: base64Tx, message } = await initRes.json();

      toast.loading("Waiting for Approval...", { id: loadToast });

      // 2. Deserialize Transaction
      // We need to use Umi or Web3.js to handle this.
      // Since the server returned Umi serialized transaction (Base64), we should use Umi on client to deserialize and sign.
      // BUT to avoid large bundle size, we can use web3.js if we are careful, OR simply use the 'serialization' helper from utils if available.
      // Actually, standard wallet adapter expects `Transaction` or `VersionedTransaction` object.

      const { VersionedTransaction } = await import('@solana/web3.js');
      const txBuffer = Buffer.from(base64Tx, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // 3. User Signs
      const adapter = wallet.adapter as any;
      if (!adapter.signTransaction) {
        throw new Error('Wallet does not support transaction signing!');
      }
      const signedTx = await adapter.signTransaction(transaction);

      toast.loading("Broadcasting to Solana...", { id: loadToast });

      // 4. Send Raw Transaction
      // We need a connection object. We can get it from useConnection() hook or create one.
      // Since we are inside a component, useConnection() is better but let's use the standard endpoint for now to be safe.
      const { Connection } = await import('@solana/web3.js');
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');

      const signature = await connection.sendRawTransaction(signedTx.serialize());

      toast.loading("Confirming...", { id: loadToast });

      // 5. Confirm
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction confirmed but failed on chain');
      }

      toast.success("Mint Successful! 🎉", { id: loadToast });
      setStatus("verified"); // Or specific 'minted' status

    } catch (error) {
      console.error('Minting error:', error);
      const message = error instanceof Error ? error.message : "Minting failed";
      toast.error(`❌ ${message}`, { id: loadToast });
      setStatus("error");
    }
  };

  const getTierLabel = (tier: Tier) => {
    switch (tier) {
      case "Oinkless":
        return "Oinkless";
      case "Oinklings":
        return "Oinklings";
      case "Midings":
        return "Midings";
      case "Oinklords":
        return "Oinklords";
      default:
        return tier;
    }
  };

  const getTierColor = (tier: Tier) => {
    switch (tier) {
      case "Oinkless":
        return "bg-red-400 hover:bg-red-500";
      case "Oinklings":
        return "bg-yellow-300 hover:bg-yellow-400";
      case "Midings":
        return "bg-blue-300 hover:bg-blue-400";
      case "Oinklords":
        return "bg-purple-300 hover:bg-purple-400";
      default:
        return "bg-gray-300 hover:bg-gray-400";
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-8 relative z-10">
      {!connected ? (
        <div className="card-cartoon p-8 bg-pastel-pink transform rotate-1">
          <h2 className="text-3xl font-pangolin font-bold text-center text-black mb-4">
            🐷 Welcome to Oinkonomics! 🐷
          </h2>
          <p className="text-xl font-pangolin text-center text-gray-800">
            Connect your wallet to discover your tier and mint your NFT!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {status === "idle" && (
            <div className="card-cartoon p-8 bg-pastel-blue transform -rotate-1">
              <h2 className="text-3xl font-pangolin font-bold text-center text-black mb-6">
                Ready to Check Your Oinks?
              </h2>
              <div className="text-center relative">
                <button onClick={handleVerify} className="blob-button bg-gradient-to-r from-pink-400 to-purple-400 text-white font-pangolin font-bold text-2xl px-8 py-4">
                  <span className="relative z-10">🐷 Vérifier mes Oinks! 🐷</span>
                </button>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="card-cartoon p-8 bg-pastel-yellow transform rotate-1">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black mx-auto mb-4"></div>
                <h2 className="text-2xl font-pangolin font-bold text-black">Verifying Identity...</h2>
                <p className="text-lg font-pangolin text-gray-700 mt-2">Checking signature & wallet balance</p>
              </div>
            </div>
          )}

          {status === "verified" && tierInfo && (
            <div className="card-cartoon p-8 bg-pastel-green transform -rotate-1">
              <h2 className="text-3xl font-pangolin font-bold text-center text-black mb-6">🎉 Congratulations! 🎉</h2>
              <p className="text-xl font-pangolin text-center text-gray-800 mb-4">
                {tierInfo.message}
              </p>

              {/* Détails du solde */}
              <div className="bg-white/70 rounded-lg p-4 mb-6 mx-auto max-w-md">
                <h3 className="text-lg font-pangolin font-bold text-center mb-2">💰 Détails de votre wallet</h3>
                <div className="space-y-1 text-center">
                  <p className="font-pangolin">Solde: <span className="font-bold">{tierInfo.balance.toFixed(4)} SOL</span></p>
                  <p className="font-pangolin">Valeur: <span className="font-bold">${tierInfo.balanceUSD.toLocaleString()}</span></p>
                  <p className="font-pangolin text-sm text-gray-600">
                    Tier {tierInfo.tier}: ${tierInfo.minThreshold.toLocaleString()} -
                    {tierInfo.maxThreshold ? `$${tierInfo.maxThreshold.toLocaleString()}` : '∞'}
                  </p>
                  {tierInfo.nftNumber && (
                    <p className="font-pangolin text-lg font-bold text-purple-600">
                      🎯 Your NFT: #{tierInfo.nftNumber}
                    </p>
                  )}
                  {tierInfo.nftRange && (
                    <p className="font-pangolin text-sm text-gray-500">
                      Range: #{tierInfo.nftRange[0]}-{tierInfo.nftRange[1]}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-center">
                {tierInfo.tier === "Oinkless" ? (
                  <button disabled className="blob-button bg-red-400 text-black font-pangolin font-bold text-2xl px-8 py-4 opacity-50 cursor-not-allowed">
                    <span className="relative z-10">❌ NO MINT FOR YOU! GET $10 FIRST!</span>
                  </button>
                ) : (
                  <div className="text-center mb-4">
                    <p className="text-lg font-pangolin text-gray-700 mb-2">
                      💰 Mint coût : <strong>0.01 SOL</strong> (~$1.8)
                    </p>
                    <button onClick={handleMint} className={`blob-button ${getTierColor(tierInfo.tier)} text-black font-pangolin font-bold text-xl px-8 py-4`}>
                      <span className="relative z-10">🐷 Minter NFT #{tierInfo.nftNumber} (0.01 SOL) 🐷</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="card-cartoon p-8 bg-gradient-to-r from-red-200 to-pink-200 transform rotate-1">
              <h2 className="text-2xl font-pangolin font-bold text-center text-black mb-4">Oops! Something went wrong</h2>
              <p className="text-lg font-pangolin text-center text-gray-800 mb-6">{errorMessage || "An unexpected error occurred"}</p>
              <div className="text-center">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setErrorMessage(null);
                  }}
                  className="blob-button bg-gradient-to-r from-gray-400 to-gray-500 text-white font-pangolin font-bold text-xl px-6 py-3"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default VerifyMint;
