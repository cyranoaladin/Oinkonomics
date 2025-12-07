import React, { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import {
    SolanaMobileWalletAdapter,
    createDefaultAuthorizationResultCache,
    createDefaultAddressSelector,
    createDefaultWalletNotFoundHandler
} from '@solana-mobile/wallet-adapter-mobile';
import {
    SOLANA_NETWORK,
    SOLANA_RPC_ENDPOINT,
    WALLETCONNECT_PROJECT_ID,
    WALLETCONNECT_RELAY_URL,
    APP_METADATA
} from '../constants/solana';

require('@solana/wallet-adapter-react-ui/styles.css');

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    // Memoize endpoint to avoid rerenders
    const endpoint = useMemo(() => SOLANA_RPC_ENDPOINT, []);
    const network = SOLANA_NETWORK;

    const wallets = useMemo(() => {
        if (typeof window === 'undefined') {
            return [];
        }

        // Dynamic URI to ensure MWA matches the current sub-domain (preventing "Malicious App" or silent rejection)
        const currentOrigin = window.location.origin;
        const iconUrl = `${currentOrigin}/favicon.ico`;

        // Check if running on mobile device
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        console.log('[WalletProvider] Initializing...', {
            network,
            projectId: WALLETCONNECT_PROJECT_ID ? 'Set' : 'Missing',
            isMobile: isMobileDevice
        });

        if (isMobileDevice) {
            // Mobile: Strict List (MWA + WalletConnect Only)
            // WE DO NOT INCLUDE INJECTED ADAPTERS (Phantom / Solflare) here to avoid conflicts
            return [
                new SolanaMobileWalletAdapter({
                    addressSelector: createDefaultAddressSelector(),
                    appIdentity: {
                        name: APP_METADATA.name,
                        uri: currentOrigin,
                        icon: iconUrl
                    },
                    authorizationResultCache: createDefaultAuthorizationResultCache(),
                    cluster: network,
                    onWalletNotFound: createDefaultWalletNotFoundHandler()
                }),
                new WalletConnectWalletAdapter({
                    network: network,
                    options: {
                        projectId: WALLETCONNECT_PROJECT_ID,
                        relayUrl: WALLETCONNECT_RELAY_URL,
                        metadata: {
                            name: APP_METADATA.name,
                            description: APP_METADATA.description,
                            url: currentOrigin,
                            icons: [iconUrl]
                        }
                    }
                })
            ];
        } else {
            // Desktop: Standard List (Injected + WalletConnect)
            // Note: We'll add standard adapters later if needed, but for now WalletConnect handles most desktop QR cases
            // and standard Extensions inject themselves automatically even if not explicitly listed in standard wallet-adapter
            return [
                new WalletConnectWalletAdapter({
                    network: network,
                    options: {
                        projectId: WALLETCONNECT_PROJECT_ID,
                        relayUrl: WALLETCONNECT_RELAY_URL,
                        metadata: {
                            name: APP_METADATA.name,
                            description: APP_METADATA.description,
                            url: currentOrigin,
                            icons: [iconUrl]
                        }
                    }
                })
            ];
        }
    }, [network]);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
