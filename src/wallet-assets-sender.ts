import { HexString } from "@ckb-lumos/lumos";
import {
  helpers,
  TransferCkbBuilder,
  AcpTransferSudtBuilder,
  CkbTypeScript,
} from '@ckitjs/ckit';
import { WalletBase } from "./wallet-base";

const { CkbAmount } = helpers;

export class WalletAssetsSender extends WalletBase {
  /**
   * 
   * @param address CKB address
   * @returns CKB balance in Shannons as string.
   */
  async getCKBBalance(address: string): Promise<string> {
    return BigInt(await this._provider.getCkbLiveCellsBalance(address)).toString();
  }

  async getSUDTBalance(address: string, issuerLockHash: string): Promise<string> {
    return BigInt(await this._provider.getUdtBalance(address, this.createSUDTTypeScript(issuerLockHash))).toString();
  }

  async getConnectedWalletCKBBalance() {
    return this.getCKBBalance(await this.getConnectedWalletCKBAddress());
  }

  async getConnectedWalletSUDTBalance(issuerLockHash: string) {
    return this.getSUDTBalance(await this.getConnectedWalletCKBAddress(), issuerLockHash);
  }

  /**
   * 
   * @param amountInShannons Amount in Shannons (lowest denominator of CKB)
   * @returns 
   */
  async assertMinimumBalanceOfCkb(amountInShannons: string) {
    const amount = CkbAmount.fromShannon(amountInShannons);
    const senderBalance = CkbAmount.fromShannon(await this.getConnectedWalletCKBBalance());
    
    if (senderBalance.lt(amount)) {
      throw new Error(`Balance of sender (address: "${await this.getConnectedWalletCKBAddress()}") has to be minimum ${amountInShannons} Shannons.`);
    }

    return true;
  }

  /**
   * Send CKB from Omnilock Layer 1 account to any CKB address.
   * 
   * @param amountInShannons Amount in Shannons (lowest denominator of CKB) to send.
   * @param toAddress CKB address to sent to.
   * @returns 
   */
  async sendCKB(amountInShannons: string, toAddress: HexString): Promise<string> {
    this.assertSignerIsDefined(this._signer);

    const txBuilder = new TransferCkbBuilder(
      { recipients: [{ recipient: toAddress, amount: amountInShannons, capacityPolicy: 'createCell' }] },
      this._provider,
      await this.getConnectedWalletCKBAddress()
    );

    const tx = await txBuilder.build();
    
    return this._provider.sendTransaction(await this._signer.seal(tx));
  }

  /**
   * 
   * @param amount Amount in lowest denominator of SUDT
   * @param toAddress CKB address
   * @param issuerLockHash SUDT issuer lock hash
   * @returns 
   */
   async sendSUDT(
      amount: string,
      toAddress: HexString,
      issuerLockHash: HexString
   ): Promise<string> {
    this.assertSignerIsDefined(this._signer);

    const txBuilder = new AcpTransferSudtBuilder(
      { recipients: [{ recipient: toAddress, amount, sudt: this.createSUDTTypeScript(issuerLockHash), policy: "createCell" }] },
      this._provider,
      await this.getConnectedWalletCKBAddress()
    );

    const tx = await txBuilder.build();
    
    return this._provider.sendTransaction(await this._signer.seal(tx));
  }

  createSUDTTypeScript(issuerLockHash: string): CkbTypeScript {
    return this._provider.newScript('SUDT', issuerLockHash);
  }
}
