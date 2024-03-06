import dotenv from 'dotenv';
import moment from 'moment';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env')});
import axios, { AxiosRequestHeaders, AxiosRequestConfig } from "axios";
import crypto from "crypto";
import { Connection, GetProgramAccountsFilter, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl, sendAndConfirmRawTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import dayjs, { OpUnitType } from 'dayjs';
import _ from 'lodash';
import { loadOrGenerateKeypair, loadPublicKeysFromFile } from './src/Helpers';
import { v4 as uuidv4 } from 'uuid'; 
import { ReadApiAsset } from '@metaplex-foundation/js';
import { base58 } from 'ethers/lib/utils';
import { createTransferCompressedNftInstruction } from './src/NFT/Transfer';
import { WrapperConnection } from '@/ReadAPI';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';

export function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

/**
 * Returns the number with 'en' locale settings, ie 1,000
 * @param x number
 * @param minDecimal number
 * @param maxDecimal number
 */
 export function toLocaleDecimal(x: number, minDecimal: number, maxDecimal: number) {
    return x.toLocaleString('en', {
        minimumFractionDigits: minDecimal,
        maximumFractionDigits: maxDecimal,
    });
}

/**
 * Runs the function if it's a function, returns the result or undefined
 * @param fn
 * @param args
 */
export const runIfFunction = (fn: any, ...args: any): any | undefined => {
    if(typeof(fn) == 'function'){
        return fn(...args);
    }

    return undefined;
}

/**
 * Returns the ellipsized version of string
 * @param x string
 * @param leftCharLength number
 * @param rightCharLength number
 */
export function ellipsizeThis(x: string, leftCharLength: number, rightCharLength: number) {
    if(!x) {
        return x;
    }

    let totalLength = leftCharLength + rightCharLength;

    if(totalLength >= x.length) {
        return x;
    }

    return x.substring(0, leftCharLength) + "..." + x.substring(x.length - rightCharLength, x.length);
}

/**
 * Returns the new object that has no reference to the old object to avoid mutations.
 * @param obj
 */
export const cloneObj = <T = any>(obj: {[key: string]: any}) => {
    return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * @returns string
 */
export const getRandomColor = () => {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export const getRandomNumber = (min: number, max: number, isInteger = false) => {
    let rand = min + (Math.random() * (max - min));
    if(isInteger) {
        rand = Math.round(rand);
    }

    else {
        // to 3 decimals
        rand = Math.floor(rand * 1000) / 1000;
    }

    return rand;
}

export const getRandomChance = () => {
    return getRandomNumber(0, 100);
}

export const getRandomNumberAsString = (min: number, max: number, isInteger = false) => {
    return getRandomNumber(min, max, isInteger).toString();
}

export const getRandomChanceAsString = () => {
    return getRandomNumberAsString(0, 100);
}

export const getUTCMoment = () => {
    return moment().utc();
}

export const getUTCDatetime = () => {
    return getUTCMoment().format('YYYY-MM-DD HH:mm:ss');
}

export const getUTCDate = () => {
    return getUTCMoment().format('YYYY-MM-DD');
}

export const getDbConfig = () => {
    const DB_USER = process.env.DB_USER ?? "";
    const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
    const DB_HOST = process.env.DB_HOST ?? "";
    const DB_PORT = process.env.DB_PORT ?? "5432";
    const DB_NAME = process.env.DB_NAME ?? "";

    return {
        user: DB_USER,
        password: DB_PASSWORD,
        host: DB_HOST,
        port: parseInt(DB_PORT),
        database: DB_NAME,
    };
}

export const getRPCEndpoint = (): string => {
    return process.env.RPC_URL? process.env.RPC_URL : clusterApiUrl("devnet");
}

export const getAdminAccount = () => {
    return Keypair.fromSecretKey(base58.decode(process.env.SECRET_KEY!));
}

export const _getAdminAccount = (): Keypair => {
    return loadOrGenerateKeypair("Admin");
}

export //get associated token accounts that stores the SPL tokens
const getTokenAccounts = async(connection: Connection, address: string) => {
  try {
    const filters: GetProgramAccountsFilter[] = [
        {
          dataSize: 165,    //size of account (bytes), this is a constant
        },
        {
          memcmp: {
            offset: 32,     //location of our query in the account (bytes)
            bytes: address,  //our search criteria, a base58 encoded string
          },            
        }];

    const accounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), //Associated Tokens Program
        {filters: filters}
    );

    /* accounts.forEach((account, i) => {
        //Parse the account data
        const parsedAccountInfo:any = account.account.data;
        const mintAddress:string = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        //Log results
        console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
        console.log(`--Token Mint: ${mintAddress}`);
        console.log(`--Token Balance: ${tokenBalance}`);
    }); */
    return accounts;
  }

  catch {
    return [];
  }
};

export const getInsertQuery = (columns: string[], values: any[][], table: string, returnId: boolean = false, schema: string = "public") => {
    let columnString = columns.join(",");
    let valueString = "";

    for(let value of values) {
        valueString +=  "(";
        for(let content of value) {
            if(typeof content === "string") {
                valueString += `'${content}'`;

            }

            else {
                valueString += `${content}`;
            }

            valueString += ",";
        }
        //remove last comma
        valueString = valueString.substring(0, valueString.length - 1);
        valueString += "),";
    }

    //remove last comma
    valueString = valueString.substring(0, valueString.length - 1);

    let query = `INSERT INTO ${schema}.${table} (${columnString}) VALUES ${valueString}`;
    if(returnId) {
        query += ' RETURNING id';
    }
    query += ';';
    return query;
}

export const getHash = (string: string): string => {
    const hash = crypto.createHash('md5').update(string).digest("hex")
    return hash;
}

export const axiosCall = async(headers: AxiosRequestHeaders, config: AxiosRequestConfig) => {
    return new Promise((resolve, reject) => {
        axios(config)
        .then((res) => {
            resolve(res.data);
        }).catch((err) => {
            // console.log(err);
            resolve(null);
        });
    });
}

/**
 * Generate crypto safe random number
 * @date 2022-10-01
 * @param { number } min
 * @param { number } max
 * @returns { number }
 */
export const getRandomIntInclusive = (min: number, max: number): number => {
    const randomBuffer = new Uint32Array(1);
    crypto.webcrypto.getRandomValues(randomBuffer);

    let randomNumber = randomBuffer[0] / (0xffffffff + 1);

    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(randomNumber * (max - min + 1)) + min;
}

export const generateRandomNumberChar = (min: number, max: number): string => {
    const charLength = getRandomIntInclusive(min, max)
    let numStr = '';

    for (let index = 0; index < charLength; index++) {
        numStr += index === 0 ? getRandomIntInclusive(1, 9).toString() : getRandomIntInclusive(0, 9).toString();
    }
    return numStr;
}

// check if the uuid is valid as sanitization
export const isValidUUID = (uuid: string) => {
    return (uuid.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)?.length ?? 0) > 0;
}

/**
 * Use to construct postgres insert, where, select columns / values query
 * @param { {
    [key : string]: any
} } params
 * @param { * } parm2
 * @param { * } parm3
 */
export const formatDBParamsToStr = (params : {
    [key : string]: any
}, separator : string = ', ', valueOnly : boolean = false, prepend: string = "") => {
    let stringParams: string[] = [];
    _.map(params, (p, k) => {
        const value = typeof p === 'string' ? `'${p.replace(/'/g, '')}'` : p;

        if (valueOnly) {
            stringParams.push(`${prepend? prepend + "." : ""}${value}`);
        } else {
            stringParams.push(`${prepend? prepend + "." : ""}${k} = ${value}`);
        }
    })

    return _.join(stringParams, separator);
}

/*
* Use to construct postgres where params with custom condition like 'LIKE', '>', '<', etc
* @param {[key: string]: { cond: string, value: any }} params
*/
export const customDBWhereParams = (params : { field: string, cond: string, value: any }[]) => {
   const stringParams: string[] = [];
   _.map(params, (wp) => {
        const value = typeof wp.value === 'string' ? `'${wp.value}'` : wp.value;
        stringParams.push(`${wp.field} ${wp.cond} ${value}`)
   });

   return _.join(stringParams, ' AND ');
}

/**
 * Convert bigint inside obj into string (faciliate JSON.stringify)
 * @param { any } obj
 */
export const convertBigIntToString = (obj : any) => {
    if (typeof obj === 'object') {
        for (let key in obj) {
            if (typeof obj[key] === 'bigint') {
                obj[key] = obj[key].toString();
            } else if (typeof obj[key] === 'object') {
                obj[key] = convertBigIntToString(obj[key]);
            }
        }
    }

    return obj;
}

export const getAddressNftDetails = async(account: string) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");
    const result = await connection.getAssetsByOwner({ ownerAddress: account });

    return result.items ?? [];
}

export const getAddressSOLBalance = async(account: string) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");

    const result = await connection.getBalance(new PublicKey(account));
    return result / 1000000000;
}

export const getSendSolTx = async(fromAccount: string, toAccount: string, amount: number) => {
    // load the env variables and store the cluster RPC url
    let lamports = Math.round(amount * 1000000000);

    let tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey(fromAccount),
            toPubkey: new PublicKey(toAccount),
            lamports,
        })
    );
    
    return tx;
}

export const transferCNfts = async(nft_ids: string[], fromAccount: string, to: string) => {
    let tx = new Transaction();

    for(const nft_id of nft_ids) {
        let ix = await createTransferCompressedNftInstruction(new PublicKey(to), new PublicKey(nft_id));
        tx.add(ix);
    }

    return tx;
}

export const getUserTokens = async(userAccount: PublicKey) => {
    // load the env variables and store the cluster RPC url
    const CLUSTER_URL = getRPCEndpoint();

    // create a new rpc connection, using the ReadApi wrapper
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");

    let mintObject: {[mintAddress: string]: {
        amount: number;
        decimals: number;
    }} = {};
    let userAccounts = await getTokenAccounts(connection, userAccount.toString());
    for(let account of userAccounts) {
      let anyAccount = account.account as any;
      let mint: string = anyAccount.data["parsed"]["info"]["mint"];
      let decimals: number = anyAccount.data["parsed"]["info"]["tokenAmount"]["decimals"];
      let accountAmount: number = anyAccount.data["parsed"]["info"]["tokenAmount"]["uiAmount"];

      mintObject[mint] = {
        amount: accountAmount,
        decimals
      };
    }

    return mintObject;
}

const createNewTransferToInstruction = async (fromAccount: string, toAccount: string, mint: string, amount: number, decimals: number, shouldCreateNewATA: boolean)=>{
    let fromAccountPubkey = new PublicKey(fromAccount);
    let toAccountPubkey = new PublicKey(toAccount);
    let mintAccountPubkey = new PublicKey(mint);

    // console.log(`---STEP 1: Get Associated Address---`);
    //get associated token account of your wallet
    const fromTokenATA = await getAssociatedTokenAddress(mintAccountPubkey, fromAccountPubkey);
    const tokenATA = await getAssociatedTokenAddress(mintAccountPubkey, toAccountPubkey);
    // let shouldCreateNewATA = !Object.keys(mintObject).includes(mintKeypair.publicKey.toBase58()); 

    const transferTokenInstruction = new Transaction();
    if(shouldCreateNewATA) {
        transferTokenInstruction.add(
            createAssociatedTokenAccountInstruction(
              fromAccountPubkey, //Payer 
              tokenATA, //Associated token account 
              toAccountPubkey, //token owner
              mintAccountPubkey, //Mint
            ),
        );
    }
    transferTokenInstruction.add(
        createTransferInstruction(
            fromTokenATA, //From Token Account
            tokenATA, //Destination Token Account
            fromAccountPubkey, //Owner
            Math.round(amount * Math.pow(10, decimals)),//number of tokens
        ),
    );

    return transferTokenInstruction;
}

// account = non public key account
export const getTokenTransferTxs = async(fromAccount: string, toAccount: string) => {
    const fromMintObject = await getUserTokens(new PublicKey(fromAccount));
    const toMintObject = await getUserTokens(new PublicKey(toAccount));

    let txs: Transaction[] = [];

    for(const [mint, { decimals, amount }] of Object.entries(fromMintObject)) {
        let shouldCreateNewATA = !toMintObject[mint]; // doesn't have the mint address
        let tx = new Transaction();
        tx.add(await createNewTransferToInstruction(fromAccount, toAccount, mint, amount, decimals, shouldCreateNewATA));
        txs.push(tx);
    }

    return txs;
}

// todo close account