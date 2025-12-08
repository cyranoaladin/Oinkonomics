'use client';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { isMobile } from '../lib/utils'; // Assurez-vous que ce chemin est correct

const WalletConnect = () => {
  const [mounted, setMounted] = useState(false);
  const [onMobile, setOnMobile] = useState(false);
  const { wallet, connect, connected } = useWallet();

  useEffect(() => {
    setMounted(true);
    setOnMobile(isMobile());
  }, []);

  // Deep link generators
  const getPhantomDeeplink = () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: "FFTLr4uWg5HdYpvgtEnxtzMQWHEoFjWVWiPQZ7Wxvsfm",
      cluster: "devnet", // Still on devnet
      app_url: "https://oinkonomics.vercel.app/",
      redirect_link: typeof window !== 'undefined' ? window.location.href : '',
    });
    return `https://phantom.app/ul/v1/connect?${params.toString()}`;
  };

  const getSolflareDeeplink = () => {
    const params = new URLSearchParams({
      ref: "https://oinkonomics.vercel.app/",
      redirect_link: typeof window !== 'undefined' ? window.location.href : '',
    });
    return `https://solflare.com/ul/v1/connect?${params.toString()}`;
  };

  const getTrustDeeplink = () => {
    return `https://link.trustwallet.com/open_url?coin_id=501&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`;
  };

  const getBackpackDeeplink = () => {
    return `backpack://browser?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`;
  };

  const getGlowDeeplink = () => {
    return `glow://browser?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`;
  };

  // Force disconnect handler
  const handleReset = async () => {
    if (wallet && connected) {
      await wallet.adapter.disconnect();
    }
    // Reload page to clear any stuck state
    window.location.reload();
  };

  const [showFallback, setShowFallback] = useState(false);

  // Show fallback options if not connected after 5 seconds on mobile
  useEffect(() => {
    if (onMobile && !connected && !wallet) {
      const timer = setTimeout(() => {
        setShowFallback(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowFallback(false);
    }
  }, [onMobile, connected, wallet]);

  return (
    <div className="relative z-50 flex flex-col items-end gap-2">
      {/* Decorative elements (hidden on very small screens) */}
      <div className="absolute -top-1 -left-2 sm:-top-1.5 sm:-left-3 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-yellow-400 rounded-full opacity-80 animate-bounce hidden sm:block" />
      <div className="absolute -top-0.5 -right-1.5 sm:-top-1 sm:-right-2 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-pink-400 rounded-full opacity-80 animate-pulse hidden sm:block" />
      <div className="absolute -bottom-0.5 -left-1.5 sm:-bottom-1 sm:-left-2 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-blue-400 rounded-full opacity-80 animate-bounce hidden sm:block" />
      <div className="absolute -bottom-1 -right-2 sm:-bottom-1.5 sm:-right-3 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-green-400 rounded-full opacity-80 animate-pulse hidden sm:block" />

      <div className="flex items-center gap-2">
        {/* Reset Button (Helpful for stuck states) */}
        <button
          onClick={handleReset}
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full border border-black transition-colors"
          title="Reset Connection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        {/* Standard Adapter with PREMIUM Styling for both Desktop & Mobile */}
        <WalletMultiButton
          style={{
            background: 'linear-gradient(135deg, #FF8AA8 0%, #FFD36E 100%)',
            borderRadius: '28px',
            border: '4px solid black',
            fontFamily: 'Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            padding: '0 24px', // Adjusted padding
            boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
            height: '48px', // Fixed height
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="wallet-adapter-button-trigger transition-transform active:scale-95 hover:scale-105"
        />
      </div>

      {/* Mobile Fallback Links */}
      {showFallback && (
        <div className="text-[10px] text-gray-500 bg-white/80 p-2 rounded border border-gray-200 shadow-sm animate-fade-in text-right">
          <p className="mb-1">Trouble connecting?</p>
          <div className="flex flex-col gap-1">
            <a href={getPhantomDeeplink()} className="text-blue-500 underline hover:text-blue-700">Open in Phantom</a>
            <a href={getSolflareDeeplink()} className="text-orange-500 underline hover:text-orange-700">Open in Solflare</a>
            <a href={getTrustDeeplink()} className="text-blue-400 underline hover:text-blue-600">Open in Trust Wallet</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
