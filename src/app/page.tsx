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

  //checkboxes
  const [shouldMigrateToken, setShouldMigrateToken] = useState(true);
  const [shouldMigrateToken2022, setShouldMigrateToken2022] = useState(true);
  const [shouldMigrateNFT, setShouldMigrateNFT] = useState(true);
  const [shouldMigrateCNFT, setShouldMigrateCNFT] = useState(true);
  const [shouldCloseEmptyAccounts, setShouldCloseEmptyAccounts] = useState(true);
  const [shouldMigrateSOL, setShouldMigrateSOL] = useState(true);

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

  const reset = useCallback(async() => {
    // reset
    setcNFTIds([]);
    setMintData({});
    setMintData2022({});
    setNftData({});
    await disconnect();
  }, [disconnect]);

  const transferToken2022s = useCallback(async() => {
      if(!shouldMigrateToken2022) {
        return;
      }
      if(!publicKey) {
        return;
      }

      if(Object.keys(mintData2022).length === 0) {
        toast.info("No token 2022 accounts");
        return;
      }

      toast.info("Preparing to migrate token 2022s");
      try {
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
      }

      catch(e) {
        console.log(e);
        toast.error("Error occured when sending token 2022");
      }
  }, [ publicKey, sendTransaction, migrateTo, mintData2022, shouldMigrateToken2022 ]);

  const transferTokens = useCallback(async() => {
      if(!shouldMigrateToken) {
        return;
      }

      if(!publicKey) {
        return;
      }

      if(Object.keys(mintData).length === 0) {
        toast.info("No token accounts");
        return;
      }
      
      toast.info("Preparing to migrate tokens");
      try {
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
      }

      catch {
        toast.error("Error occured when sending token");
      }
  }, [ publicKey, sendTransaction, migrateTo, mintData, shouldMigrateToken ]);

  const transferNfts = useCallback(async() => {
      if(!shouldMigrateNFT) {
        return;
      }

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
      
      toast.info("Preparing to migrate NFTs");
      try {
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
            if(count == 2) {
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
      }

      catch {
        toast.error("Error occured when sending nft");
      }
  }, [ publicKey, sendTransaction, migrateTo, nftData, signAllTransactions, shouldMigrateNFT ]);

  const transfercNFTs = useCallback(async() => {
    if(!shouldMigrateCNFT) {
      return;
    }
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

    toast.info("Preparing to migrate cNFTs");
    try {
        const umi = createUmi(getRPCEndpoint());
        const signer = createSignerFromWalletAdapter(wallet.adapter);
        umi.use(mplBubblegum());
        umi.use(signerIdentity(signer));
    
        for(const id of cNFTIds) {
            try {
              toast.info(`Preparing tx for ${id}`);
                const assetWithProof = await getAssetWithProof(umi, convertToUmiPublicKey(id));
                transfer(umi, {
                  ...assetWithProof,
                  leafOwner: convertToUmiPublicKey(publicKey.toBase58()),
                  newLeafOwner: convertToUmiPublicKey(migrateTo),
                }).sendAndConfirm(umi);
                // throttle
                await sleep(1000);
            }
    
            catch(e) {
                console.log(e);
                continue;
            }
        }
    }

    catch {
        toast.error("Error occured when sending cnft");
    }

  }, [cNFTIds, migrateTo, publicKey, wallet, shouldMigrateCNFT]);

  const closeAccounts = useCallback(async() => {
    if(!shouldCloseEmptyAccounts) {
      return;
    }
    if(!publicKey) {
        return;
    }

    let connection = new Connection(getRPCEndpoint());
    let tx = await getCloseEmptyAccountTxs(publicKey.toBase58());
    if(tx.instructions.length === 0) {
        toast.info("No empty accounts");
        return;
    }
    
    toast.info("Waiting for network to update token accounts");
    await sleep(5000);

    toast.info("Preparing to close empty accounts");
    try {
        let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;
        await sendTransaction(tx, connection);
        toast.info("Waiting for network to update SOL Balance");
        await sleep(5000);
    }

    catch {
        toast.error("Error occured when closing account");
    }
  }, [ sendTransaction, publicKey, shouldCloseEmptyAccounts ]);

  const migrateSol = useCallback(async() => {
    if(!shouldMigrateSOL) {
      return;
    }
    if(!publicKey) {
        return;
    }

    toast.info("Preparing to migrate SOLs");
    try {
        let connection = new Connection(getRPCEndpoint());
        let solBalance = await getAddressSOLBalance(publicKey.toBase58());
        let tx = await getSendSolTx(publicKey.toBase58(), migrateTo, solBalance - 0.001);
        let {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;
        await sendTransaction(tx, connection);
    }

    catch {
        toast.error("Error occured when sending SOL");
    }

  }, [ publicKey, migrateTo, sendTransaction, shouldMigrateSOL ]);

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

    await transferToken2022s();
    await transferTokens();
    await transferNfts();
    await transfercNFTs();
    await closeAccounts();
    await migrateSol(); 
    toast.success("Migration complete, disconnecting wallet");
    await reset();

  }, [isOnCurve, publicKey, signAllTransactions, transferToken2022s, transferTokens, transferNfts, closeAccounts, migrateSol, transfercNFTs, reset ]);

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
            {
                publicKey &&
                <>
                <span>Current Address</span>
                <div  className='mb-5'>{publicKey?.toBase58()} <button className='rounded bg-red-600 px-3 py-2 w-[10vw]' onClick={() => reset()}>Disconnect</button> </div>
                </>
            }
            <span>Migrate To Address</span>
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
                <div className='flex flex-col space-y-3 items-center mb-3'>
                  <span className='text-xl font-bold text-center'>Found {solBalance} SOL, {Object.keys(mintData).length} Token(s), {Object.keys(mintData2022).length} Token 2022(s), {Object.keys(nftData).length} NFT(s), and {cNFTIds.length} cNFTs</span>
                  <button className='rounded bg-green-600 px-3 py-2 w-[30vw]' onClick={migrate}>Migrate</button>
                  <div className='flex flex-row'>
                    <span>Tokens</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldMigrateToken} onClick={() => setShouldMigrateToken(!shouldMigrateToken)}/>
                    <span className='ml-3'>Token2022</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldMigrateToken2022} onClick={() => setShouldMigrateToken2022(!shouldMigrateToken2022)}/>
                    <span className='ml-3'>NFTs</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldMigrateNFT} onClick={() => setShouldMigrateNFT(!shouldMigrateNFT)}/>
                    <span className='ml-3'>cNFTs</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldMigrateCNFT} onClick={() => setShouldMigrateCNFT(!shouldMigrateCNFT)}/>
                    <span className='ml-3'>Close Empty Accounts</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldCloseEmptyAccounts} onClick={() => setShouldCloseEmptyAccounts(!shouldCloseEmptyAccounts)}/>
                    <span className='ml-3'>SOLs</span>
                    <input className='ml-1' type="checkbox" defaultChecked={shouldMigrateSOL} onClick={() => setShouldMigrateSOL(!shouldMigrateSOL)}/>
                  </div>
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
