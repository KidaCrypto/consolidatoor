'use client';

import Header from '@/components/Header';
import { ConnectionProvider, useWallet} from '@solana/wallet-adapter-react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { redirect, usePathname } from 'next/navigation';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import React from 'react';

// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css');
export const WalletModalContext = createContext<{
    setIsWalletModalOpen: (isOpen: boolean) => void;
}>({
    setIsWalletModalOpen: () => {}
});

const Wrapped = ({
    children,
  }: {
    children: React.ReactNode
  }) => {
    const wallet = useWallet();
    const [isHeaderHidden, setIsHeaderHidden] = useState(false);
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const pathname = usePathname();

    const address = useMemo(() => {
        return wallet.publicKey?.toBase58() ?? "";
    }, [wallet]);

    const onSidebarToggle = useCallback(() => {
        setIsSidebarActive(!isSidebarActive);
    }, [ isSidebarActive ]);

    const closeSidebar = useCallback(() => {
        setIsSidebarActive(false);
    }, []);

    useEffect(() => {
        // close sidebar when the path changes
        closeSidebar();
    }, [ pathname, closeSidebar ]);

    return (
        <WalletModalContext.Provider
            value={{
                setIsWalletModalOpen
            }}
        >
            <div className={`
                w-full max-h-screen overflow-auto
                relative
            `}>
                <Header 
                    onMenuClick={onSidebarToggle}
                    onHeaderVisibilityChange={setIsHeaderHidden}
                />
                <div>
                    {children}
                </div>
            </div>
        </WalletModalContext.Provider>
    )
}

const Layout = ({
    children,
  }: {
    children: React.ReactNode
  }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Mainnet;
  
    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const {theme} = useTheme();
  
    return (
        <ConnectionProvider endpoint={endpoint}>
            <UnifiedWalletProvider
                wallets={[]}
                config={{
                    autoConnect: true,
                    env: "mainnet-beta",
                    metadata: {
                        name: "UnifiedWallet",
                        description: "UnifiedWallet",
                        url: "https://jup.ag",
                        iconUrls: ["https://jup.ag/favicon.ico"],
                    },
                    // notificationCallback: {},
                    walletlistExplanation: {
                        href: "https://station.jup.ag/docs/additional-topics/wallet-list",
                    },
                    theme: "dark",
                    lang: "en",
                }}
            >
            <Wrapped>
                {children}
            </Wrapped>
            </UnifiedWalletProvider>
        </ConnectionProvider>
    )
}

export const ThemeLayout = ({
    children,
  }: {
    children: React.ReactNode
  }) => {
    return (
        <ThemeProvider>
            <Layout>
                {children}
            </Layout>
        </ThemeProvider>
    )
}

export default ThemeLayout;