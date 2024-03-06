import Layout from '@/components/Layout';
import React from 'react';
import './globals.css'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Head from 'next/head';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL("https://consolidatooor.kidas.app"),
  title: 'Consolidatooor',
  description: 'Consolidate your wallets.',
  keywords: "consolidatooor, solana",
  openGraph: {
    title: "Consolidatooor",
    description: "Consolidate your wallets.",
    images: [
        {
          url: 'https://kidas.app/logo-kida.png',
          width: 1015,
          height: 351,
          alt: 'Consolidatooor Logo',
          type: 'image/png',
        },
    ],
    siteName: "Consolidatooor",
    url: "https://consolidatooor.kidas.app",
    type: "website",
  },
  twitter: {
    site: '@darksoulsfanlol',
    title: "Consolidatooor",
    creator: "@darksoulsfanlol",
    description: "Consolidate your wallets.",
    images: [
      {
        url: 'https://kidas.app/logo-kida.png',
        width: 1015,
        height: 351,
        alt: 'Consolidatooor Logo',
        type: 'image/png',
      },
    ],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className='dark'>
      <Head>
        <link
          rel="canonical"
          href="https://consolidatooor.kidas.app"
          key="canonical"
        />
      </Head>
      <body className={`
        ${inter.className} 
        flex flex-row dark:bg-black dark:text-white bg-white text-black
      `}>
          <Layout>
            {children}

            <ToastContainer
              position="bottom-center"
              autoClose={3000}
              hideProgressBar={true}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnHover={false}
              theme={'colored'}
            />
          </Layout>
      </body>
    </html>
  )
}
