import { Wallet } from 'ethers';
import fs from 'fs';

const walletPath = '/keystore/account.eth';

export const getWallet = () => {
  if (fs.existsSync(walletPath)) {
    const wallet = fs.readFileSync(walletPath);
    return JSON.parse(wallet);
  }
  const wallet = Wallet.createRandom();
  fs.writeFileSync(walletPath, JSON.stringify(wallet));
  return wallet;
};

export default {
  getWallet,
};