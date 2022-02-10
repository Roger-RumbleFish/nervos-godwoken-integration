import {
    CkitProvider,
    internal,
    EntrySigner,
    RcOwnerWallet,
    AbstractWallet,
    RcIdentity,
    RcIdentityFlag,
    predefined,
    CkitInitOptions
} from '@ckitjs/ckit';

const { RcEthSigner } = internal;

export interface RcSigner extends EntrySigner {
    getRcIdentity(): RcIdentity;
}

function isRcSigner(signer: EntrySigner): signer is RcSigner {
    return (signer as RcSigner).getRcIdentity !== undefined;
}

function createCkitProvider(ckbUrl: string, ckbIndexerUrl: string) {
    const provider = new CkitProvider(ckbIndexerUrl, ckbUrl);
    const wallet = new RcOwnerWallet(provider);
    const signer = wallet.getSigner();

    return { provider, signer, wallet };
}

export class WalletBase {
    protected _provider: CkitProvider;
    protected _signer: RcSigner | undefined;

    private _wallet: AbstractWallet | undefined;

    constructor(ckbUrl: string, ckbIndexerUrl: string) {
        const { provider, signer, wallet } = createCkitProvider(ckbUrl, ckbIndexerUrl);

        this._provider = provider;

        if (signer) {
            if (!isRcSigner(signer)) {
                throw new Error(`<AddressTranslator>._signer is not RcSigner.`);
            }

            this._signer = signer;
        }
        
        this._wallet = wallet;
    }

    public async init(chain: 'testnet' | 'mainnet' | CkitInitOptions) {
        if (typeof chain === 'string') {
          if (chain === 'mainnet') {
            await this._provider.init(predefined.Lina);
          } else {
            await this._provider.init(predefined.Aggron);
          }
        } else {
          await this._provider.init(chain);
        }
      }

    async connectWallet(ethereumPrivateKey?: string): Promise<void> {
        if (ethereumPrivateKey) {
          this._signer = new RcEthSigner(ethereumPrivateKey, this._provider);
          return;
        }

        if (this._wallet && this._signer && this._wallet.getConnectStatus() === 'connected') {
            return;
        }
    
        return new Promise<void>((resolve, reject) => {
          if (this._signer) {
            return resolve();
          }
    
          if (!this._wallet) {
            return reject(`<AddressTranslator>._wallet is undefined. Can't connect to it.`);
          }
    
          const listener = (signer: EntrySigner) => {
            if (!isRcSigner(signer)) {
              throw new Error(`<AddressTranslator>._signer is not RcSigner.`);
            }
    
            if (!this._wallet) {
              return reject(`<AddressTranslator>._wallet is undefined. Can't connect to it.`);
            }
    
            this._signer = signer;
    
            const walletStatus = this._wallet.getConnectStatus();
            if (walletStatus === 'connected') {
              resolve();
            } else {
              reject(`<AddressTranslator> wallet status is: "${walletStatus}". Expected "connected".`);
            }
    
            (this._wallet as any).emitter.off(listener);
            resolve();
          }
    
          this._wallet.on('signerChanged', listener);
    
          this._wallet.connect();
        });
      }
    
      getConnectedWalletAddress(): string | undefined {
        const identity = this._signer?.getRcIdentity();
    
        if (!identity || identity.flag !== RcIdentityFlag.ETH) {
          return undefined;
        }
    
        return identity.pubkeyHash;
      }
}