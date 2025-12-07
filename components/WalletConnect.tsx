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

  const [showFallback, setShowFallback] = useState(false);

  // No custom modal state needed anymore
  // const [isModalOpen, setIsModalOpen] = useState(false);

  // Force disconnect handler
  const handleReset = async () => {
    if (wallet && connected) {
      await wallet.adapter.disconnect();
    }
    // Reload page to clear any stuck state
    window.location.reload();
  };

  if (!mounted) {
    return (
      <div className="relative">
        <div
          className="px-4 py-2 rounded-lg bg-gray-200 border-2 border-black"
          style={{ minWidth: '180px', minHeight: '40px' }}
        />
      </div>
    );
  }

  return (
    <div className="relative z-50 flex flex-col items-end">
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
    </div>
  );
};

export default WalletConnect;
