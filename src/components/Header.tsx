'use client';
import { BarsOutlined, SearchOutlined } from '@ant-design/icons';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';

type HeaderParams = {
    onMenuClick: () => void;
    onHeaderVisibilityChange: (isHidden: boolean) => void;
}

const Header = ({onMenuClick, onHeaderVisibilityChange}: HeaderParams) => {
    const wallet = useWallet();
    const pathname = usePathname();

    return (
      <div className={`
        justify-between md:justify-end
        flex flex-row px-3 items-center 
        h-[60px]
        fixed bottom-2
        z-[55]
      `}>
        {/** menu button */}
        <button
            className={`
                flex md:hidden
                flex-row items-center justify-center
                rounded-full border-slate-500 border-[1px]
                dark:bg-slate-700 bg-indigo-300
                px-3 py-2
                h-[40px] w-[40px]
            `}
            onClick={onMenuClick}
        >
            <BarsOutlined 
                style={{
                    fontSize: 20
                }}
            />
        </button>
        {/* <div className='dark:bg-slate-700 rounded border-slate-500 border-[1px] shadow'>
            <button onClick={() => { 
                if(wallet?.wallet?.isConnected) {
                    wallet!.disconnect!();
                    return;
                }

                wallet!.connect!('backpack');
             }}>{wallet.publicKey? 'Disconnect' : 'Connect'}</button>
        </div> */}
      </div>
    )
}

export default Header;