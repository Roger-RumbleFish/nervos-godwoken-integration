import { HexString } from "@ckb-lumos/lumos";
import {
  helpers,
  TransferCkbBuilder,
} from '@ckitjs/ckit';
import { WalletBase } from "./wallet-base";

const { CkbAmount } = helpers;
export class WalletAssetsSender extends WalletBase {
  async assertMinimumBalanceOfCkb(amountInCkb: string) {
    if (!this._signer) {
      throw new Error('<WalletAssetsSender>._signer is undefined. Make sure Web3 provider is in window context or pass Ethereum private key to constructor.');
    }

    const amount = CkbAmount.fromCkb(amountInCkb);
    const sender = await this._signer.getAddress();

    const senderBalance = CkbAmount.fromShannon(await this._provider.getCkbLiveCellsBalance(sender));
    
    if (senderBalance.lt(amount)) {
      throw new Error(`Balance of sender (address: "${sender}") has to be minimum 462 CKB.`);
    }

    return true;
  }

  /**
   * Send CKB from Omnilock Layer 1 account to any CKB address.
   */
  async sendCKB(amountInCkb: string, toAddress: HexString): Promise<string> {
    if (!this._signer) {
      throw new Error('<WalletAssetsSender>._signer is undefined. Make sure Web3 provider is in window context or pass Ethereum private key to constructor.');
    }

    const amount = CkbAmount.fromCkb(amountInCkb);
    const sender = await this._signer.getAddress();

    const txBuilder = new TransferCkbBuilder(
      { recipients: [{ recipient: toAddress, amount: amount.toString(), capacityPolicy: 'createCell' }] },
      this._provider,
      sender,
    );

    const tx = await txBuilder.build();
    
    const txHash = await this._provider.sendTransaction(await this._signer.seal(tx));
      
    return txHash;
  }
}
