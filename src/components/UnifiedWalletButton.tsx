import React, { ReactNode, useCallback } from 'react';
import { SolanaMobileWalletAdapterWalletName } from '@solana-mobile/wallet-adapter-mobile';
import { useUnifiedWallet, useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { WalletOutlined, WalletFilled } from '@ant-design/icons';

export const MWA_NOT_FOUND_ERROR = 'MWA_NOT_FOUND_ERROR';

export const UnifiedWalletButton: React.FC<{
  overrideContent?: ReactNode;
  buttonClassName?: string;
  currentUserClassName?: string;
}> = ({ overrideContent, buttonClassName: className, currentUserClassName }) => {
  const { setShowModal, theme } = useUnifiedWalletContext();
  const { disconnect, connect, connecting, wallet } = useUnifiedWallet();

  const handleClick = useCallback(async () => {
    try {
      if (wallet?.adapter?.name === SolanaMobileWalletAdapterWalletName) {
        await connect();

        return;
      } else {
        setShowModal(true);
      }
    } catch (error) {
      if (error instanceof Error && error.message === MWA_NOT_FOUND_ERROR) {
        setShowModal(true);
      }
    }
  }, [wallet, connect, setShowModal]);

  return (
    <>
    <button
        className='flex items-center justify-center h-[40px] min-w-[40px] mr-2 rounded-full hover:dark:bg-gray-500 hover:bg-gray-300'
        onClick={handleClick}
    >
        <WalletOutlined
          style={{
              fontSize: 20
          }}
          className='hidden dark:block'
        />
        <WalletFilled
          style={{
              fontSize: 20
          }}
          className='dark:hidden'
        />
    </button>
    </>
  );
};