'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton, WalletName } from '@jup-ag/wallet-adapter';
import { getAccountNfts, getAccountNftsObject, getAddressNftDetails, getAddressSOLBalance, getCloseEmptyAccountTxs, getNftTransferTxs, getRPCEndpoint, getSendSolTx, getToken2022TransferTxs, getTokenTransferTxs, getUserToken2022s, getUserTokens, sleep } from '../../utils';
import { Hourglass } from "react-loader-spinner";
import { Connection, PublicKey, Transaction, sendAndConfirmRawTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { ReadApiAsset, Metaplex, PublicKey as MetaPublicKey, token, Signer, walletAdapterIdentity } from '@metaplex-foundation/js';
import { getAssetWithProof, mplBubblegum, transfer } from '@metaplex-foundation/mpl-bubblegum';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey as convertToUmiPublicKey, PublicKey as UmiPublicKey } from "@metaplex-foundation/umi-public-keys";
import { createSignerFromWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { signerIdentity } from '@metaplex-foundation/umi';
import { toast } from 'react-toastify';

const Page = () => {
  const { wallet, publicKey, disconnect, signAllTransactions, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [migrateTo, setMigrateTo] = useState("");
  const [mintData, setMintData] = useState<{
    [mintAddress: string]: {
        amount: number;
        decimals: number;
    };
  }>({});
  const [mintData2022, setMintData2022] = useState<{
    [mintAddress: string]: {
        amount: number;
        decimals: number;
    };
  }>({});
  const [solBalance, setSolBalance] = useState(0);
  const [nftData, setNftData] = useState<{
    [mintAddress: string]: string;
  }>({});
  const [cNFTIds, setcNFTIds] = useState<string[]>([]);
  const lastKey = useRef("");

  const isOnCurve = useMemo(() => {
    try {
      return PublicKey.isOnCurve(migrateTo);
    }

    catch {
      return false;
    }
  }, [migrateTo]);

  const transferToken2022s = useCallback(async() => {
      if(!publicKey) {
        return;
      }

      if(Object.keys(mintData2022).length === 0) {
        toast.info("No token 2022 accounts");
        return;
      }

      let connection = new Connection(getRPCEndpoint());
      let tx = await getToken2022TransferTxs(publicKey.toBase58(), migrateTo);
      if(tx.instructions.length === 0) {
        return;
      }
      let { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = publicKey;
      await sendTransaction(tx, connection);
  }, [ publicKey, sendTransaction, migrateTo, mintData2022 ]);

  const transferTokens = useCallback(async() => {
      if(!publicKey) {
        return;
      }

      if(Object.keys(mintData).length === 0) {
        toast.info("No token accounts");
        return;
      }
      
      let connection = new Connection(getRPCEndpoint());
      let tx = await getTokenTransferTxs(publicKey.toBase58(), migrateTo);
      if(tx.instructions.length === 0) {
        return;
      }
      let { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = publicKey;
      await sendTransaction(tx, connection);
  }, [ publicKey, sendTransaction, migrateTo, mintData ]);

  const transferNfts = useCallback(async() => {
      if(!publicKey) {
        return;
      }

      if(!signAllTransactions) {
        return;
      }

      if(Object.keys(nftData).length === 0) {
        toast.info("No NFTs");
        return;
      }
      
      let nfts = await getAccountNfts(publicKey.toBase58());
      let txs: Transaction[] = [];
      let connection = new Connection(getRPCEndpoint());
      const metaplex = new Metaplex(connection);
      metaplex.use(walletAdapterIdentity({
          publicKey,
          signTransaction: async (tx) => tx,
      }));    

      const feePayer: Signer = {
          publicKey,
          signTransaction: async (tx) => tx,
          signMessage: async (msg) => msg,
          signAllTransactions: async (txs) => txs,
      };

      let tx = new Transaction();

      let count = 0;
      for(const nft of nfts) {

          count++;  
          const txBuilder = metaplex.nfts().builders().transfer({
              nftOrSft: nft,
              fromOwner: publicKey,
              toOwner: new PublicKey(migrateTo),
              amount: token(1),
              authority: feePayer,
          });

          let ixs = txBuilder.getInstructions();
          tx.add(...ixs);

          // txs cant get too large
          if(count == 3) {
            count = 0;
            let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = blockhash;
            tx.lastValidBlockHeight = lastValidBlockHeight;
            tx.feePayer = publicKey;
            try {
              await sendTransaction(tx, connection);
            }

            catch(e) {
              console.log(e);
            }
            tx = new Transaction();
            continue;
          }
      }
      let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = publicKey;
      await sendTransaction(tx, connection);
  }, [ publicKey, sendTransaction, migrateTo, nftData, signAllTransactions ]);

  const transfercNFTs = useCallback(async() => {
    if(!publicKey) {
        return;
    }

    if(!cNFTIds || cNFTIds.length === 0) {
        toast.info("No cNFTs");
        return;
    }

    if(!wallet) {
        return;
    }

    console.log('here2')
    const umi = createUmi(getRPCEndpoint());
    const signer = createSignerFromWalletAdapter(wallet.adapter);
    umi.use(mplBubblegum());
    umi.use(signerIdentity(signer));
    console.log('here3')

    for(const id of cNFTIds) {
        try {
            const assetWithProof = await getAssetWithProof(umi, convertToUmiPublicKey(id));
            await transfer(umi, {
              ...assetWithProof,
              leafOwner: convertToUmiPublicKey(publicKey.toBase58()),
              newLeafOwner: convertToUmiPublicKey(migrateTo),
            }).sendAndConfirm(umi);
            console.log('here')
        }

        catch(e) {
            console.log(e);
            continue;
        }
    }

    console.log('ended')

  }, [cNFTIds, migrateTo, publicKey, wallet]);

  const closeAccounts = useCallback(async() => {
    if(!publicKey) {
        return;
    }

    let connection = new Connection(getRPCEndpoint());
    let tx = await getCloseEmptyAccountTxs(publicKey.toBase58());
    if(tx.instructions.length === 0) {
        toast.info("No empty accounts");
        return;
    }
    let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = publicKey;
    await sendTransaction(tx, connection);
  }, [ sendTransaction, publicKey ]);

  const migrateSol = useCallback(async() => {
    if(!publicKey) {
        return;
    }

    let connection = new Connection(getRPCEndpoint());
    let solBalance = await getAddressSOLBalance(publicKey.toBase58());
    let tx = await getSendSolTx(publicKey.toBase58(), migrateTo, solBalance - 0.001);
    let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = publicKey;
    await sendTransaction(tx, connection);

  }, [ publicKey, migrateTo, sendTransaction ]);

  const getData = useCallback(async() => {
    if(!publicKey) {
      return;
    }
    setIsLoading(true);
    let mintData = await getUserTokens(publicKey);
    let solBalance = await getAddressSOLBalance(publicKey.toBase58());
    let mintData2022 = await getUserToken2022s(publicKey);
    setMintData(mintData);
    setMintData2022(mintData2022);
    setSolBalance(solBalance);
    let nfts = await getAccountNftsObject(publicKey.toBase58());
    setNftData(nfts);
    const cNFTs = (await getAddressNftDetails(publicKey.toBase58())).filter(x => x.compression.compressed);
    if(cNFTs.length !== 0) {
      setcNFTIds(cNFTs.map(x => x.id));
    }
    setIsLoading(false);
  }, [publicKey]);

  const migrate = useCallback(async() => {
    if(!isOnCurve) {
      return;
    }

    if(!publicKey) {
      return;
    }

    if(!signAllTransactions) {
      return;
    }

    // first transfer all tokens
    toast.info("Preparing to migrate token 2022s");
    try {
        await transferToken2022s();
    }

    catch(e) {
        console.log(e);
        toast.error("Error occured when sending token 2022");
    }
    // toast.info("Preparing to migrate tokens");
    // try {
    //     await transferTokens();
    // }

    // catch {
    //     toast.error("Error occured when sending token");
    // }
    // toast.info("Preparing to migrate NFTs");
    // try {
    //     await transferNfts();
    // }

    // catch {
    //     toast.error("Error occured when sending nft");
    // }
    // // toast.info("Preparing to migrate cNFTs");
    // // try {
    // //     await transfercNFTs();
    // // }

    // // catch {
    // //     toast.error("Error occured when sending cnft");
    // // }
    // toast.info("Preparing to close empty accounts");
    // try {
    //     await closeAccounts();
    // }

    // catch {
    //     toast.error("Error occured when closing account");
    // }
    // toast.info("Waiting for network to update SOL Balance");
    // await sleep(5000);
    // toast.info("Preparing to migrate SOLs");
    // try {
    //     await migrateSol();    
    // }

    // catch {
    //     toast.error("Error occured when sending SOL");
    // }

    // toast.success("Migrated, disconnecting wallet");
    // await disconnect();
  }, [isOnCurve, publicKey, signAllTransactions, transferToken2022s, transferTokens, transferNfts, disconnect, closeAccounts, migrateSol, transfercNFTs ]);

  useEffect(() => {
    if(publicKey?.toBase58() === lastKey.current) {
      return;
    }

    lastKey.current = publicKey?.toBase58() ?? "";
    getData();
  }, [publicKey, getData]);

	return (
		<div className="min-h-[100vh] w-100 flex items-center justify-center flex-1">
      <div className="flex-1 flex flex-col justify-center items-center">
          <input 
            className={`text-black p-1 w-[50vw] outline-none ${isOnCurve? '' : 'border-red-500 border-2 text-red-500'}`}
            type="text" 
            placeholder='Migrate to this address'
            onChange={({ target }) => { setMigrateTo(target.value) }}
          />
          {
            !isOnCurve &&
            <span className='text-red-300'>Invalid Address!</span>
          }
          <div className="mt-10"></div>
          {
            !publicKey &&
            <>
            <span>Select a wallet to migrate from</span>
            <div className="border-[1px] border-black rounded mt-3">
                <UnifiedWalletButton/>
            </div>
            </>
          }
          {
            publicKey &&
            <>
            <span className='mb-5'>Current Address: {publicKey?.toBase58()}</span>

            {
              isLoading &&
              <Hourglass
                  visible={true}
                  height="80"
                  width="80"
                  ariaLabel="hourglass-loading"
                  wrapperStyle={{}}
                  wrapperClass=""
                  colors={['#306cce', '#72a1ed']}
              />
            }

            {
              !isLoading &&
              mintData &&
              <div className='items-center justify-center flex flex-col'>
                <div className='flex flex-row space-x-3 items-center mb-3'>
                  <span className='text-xl font-bold text-center'>Found {solBalance} SOL, {Object.keys(mintData).length} Token(s), {Object.keys(mintData2022).length} Token 2022(s), {Object.keys(nftData).length} NFT(s), and {cNFTIds.length} cNFTs</span>
                  <button className='rounded bg-green-600 px-3 py-2' onClick={migrate}>Migrate</button>
                </div>

                {
                    Object.keys(mintData).length > 0 &&
                    <div className='text-lg'>
                      Token Details
                    </div>
                }
                {
                  Object.entries(mintData).map(x => {
                    let mintAddress = x[0];
                    let { decimals, amount } = x[1];

                    return (
                      <div key={mintAddress}>
                        <span>{amount.toFixed(8)} {mintAddress}</span>
                      </div>
                    )
                  })
                }
                {
                    Object.keys(mintData2022).length > 0 &&
                    <div className='text-lg mt-3'>
                      Token 2022 Details
                    </div>
                }
                {
                  Object.entries(mintData2022).map(x => {
                    let mintAddress = x[0];
                    let { decimals, amount } = x[1];

                    return (
                      <div key={mintAddress}>
                        <span>{amount.toFixed(8)} {mintAddress}</span>
                      </div>
                    )
                  })
                }
                {
                    Object.keys(nftData).length > 0 &&
                    <div className='text-lg mt-3'>
                      NFT Details
                    </div>
                }
                {
                  Object.entries(nftData).map(x => {
                    let mintAddress = x[0];
                    let name = x[1];

                    return (
                      <div key={mintAddress}>
                        <span>{name}</span>
                      </div>
                    )
                  })
                }
              </div>
            }
            </>
          }

      </div>
		</div>
	);
};

export default Page;
