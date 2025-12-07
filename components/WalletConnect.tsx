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
    // Déclenche la connexion automatique si on est dans le navigateur Phantom ou Solflare
    if (isMobile() && (window.navigator.userAgent.includes('Phantom') || window.navigator.userAgent.includes('Solflare'))) {
      if (wallet && !connected) {
        connect();
      }
    }
  }, [wallet, connected, connect]);

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

  // Force disconnect handler
  const handleReset = async () => {
    if (wallet && connected) {
      await wallet.adapter.disconnect();
    }
    // Reload page to clear any stuck state
    window.location.reload();
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Close modal when clicking outside
  const closeModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
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
        {/* Reset Button */}
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

        {/* DESKTOP: Standard Adapter Button / MOBILE: Custom Button */}
        {!onMobile || connected ? (
          <WalletMultiButton
            style={{
              background: 'linear-gradient(135deg, #FF8AA8 0%, #FFD36E 100%)',
              borderRadius: '28px',
              border: '4px solid black',
              fontFamily: 'Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              padding: '12px 20px',
              boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
              minHeight: '44px',
            }}
            className="transition-transform active:scale-95 hover:scale-105 sm:text-base text-sm"
          />
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="font-grotesk font-bold text-base px-6 py-3 rounded-[28px] border-[4px] border-black shadow-[0_6px_12px_rgba(0,0,0,0.15)] bg-gradient-to-br from-[#FF8AA8] to-[#FFD36E] text-white transition-transform active:scale-95 hover:scale-105"
          >
            Select Wallet
          </button>
        )}
      </div>

      {/* MOBILE MODAL OVERLAY */}
      {isModalOpen && !connected && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full max-w-sm rounded-[32px] border-[4px] border-black shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black font-grotesk">Connect Wallet</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Wallet Grid */}
            <div className="grid grid-cols-2 gap-4">
              <a href={getPhantomDeeplink()} className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-200 hover:border-[#AB9FF2] hover:bg-[#AB9FF2]/10 transition-all active:scale-95 gap-3 group">
                <div className="w-12 h-12 bg-[#AB9FF2] rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  {/* Simplified Phantom Icon */}
                  <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
                </div>
                <span className="font-bold text-sm text-gray-700 group-hover:text-black">Phantom</span>
              </a>

              <a href={getSolflareDeeplink()} className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-200 hover:border-[#FC7225] hover:bg-[#FC7225]/10 transition-all active:scale-95 gap-3 group">
                <div className="w-12 h-12 bg-[#FC7225] rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  {/* Solflare Icon Style */}
                  <div className="w-6 h-6 border-4 border-white rounded-full"></div>
                </div>
                <span className="font-bold text-sm text-gray-700 group-hover:text-black">Solflare</span>
              </a>

              <a href={getTrustDeeplink()} className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-200 hover:border-[#3375BB] hover:bg-[#3375BB]/10 transition-all active:scale-95 gap-3 group">
                <div className="w-12 h-12 bg-[#3375BB] rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  {/* Trust Shield */}
                  <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
                </div>
                <span className="font-bold text-sm text-gray-700 group-hover:text-black">Trust Wallet</span>
              </a>

              {/* Standard Adapter Fallback */}
              <div className="col-span-2 mt-2">
                <p className="text-center text-xs text-gray-400 mb-2 font-medium">Other Wallets</p>
                <div onClick={() => setIsModalOpen(false)} className="flex justify-center">
                  <WalletMultiButton
                    style={{ background: 'transparent', color: 'black', border: '1px solid #e5e7eb', boxShadow: 'none' }}
                    className="!bg-white !text-black !h-10 !px-4 !text-sm hover:!bg-gray-50 !border-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;

