import { Script, HexString, utils, Hash, PackedSince, Address as CkbAddress } from "@ckb-lumos/lumos";
import defaultConfig from "../config/config.json";
import { DepositionLockArgs, IAddressTranslatorConfig } from "./types";
import { DeploymentConfig } from "../config/types";
import {
  generateDeployConfig,
  generateDepositionLock,
  getRollupTypeHash,
  serializeArgs,
} from "./helpers";
import { WalletAssetsSender } from "../wallet-assets-sender";

export class AddressTranslator extends WalletAssetsSender {
  public _config: IAddressTranslatorConfig

  private _deploymentConfig: DeploymentConfig

  constructor(config?: IAddressTranslatorConfig) {
    let configToSet;

    if (config) {
      configToSet = config;
    } else {
      configToSet = {
        CKB_URL: defaultConfig.ckb_url,
        RPC_URL: defaultConfig.rpc_url,
        INDEXER_URL: defaultConfig.indexer_url,
        deposit_lock_script_type_hash:
          defaultConfig.deposit_lock.script_type_hash,
        eth_account_lock_script_type_hash:
          defaultConfig.eth_account_lock.script_type_hash,
        rollup_type_script: defaultConfig.chain.rollup_type_script,
        rollup_type_hash: defaultConfig.rollup_script_hash,
        rc_lock_script_type_hash: defaultConfig.rc_lock_script_type_hash,
      };
    }

    super(configToSet.CKB_URL, configToSet.INDEXER_URL);

    this._config = configToSet;

    this._deploymentConfig = generateDeployConfig(
      this._config.deposit_lock_script_type_hash,
      this._config.eth_account_lock_script_type_hash
    );    
  }

  public clone(): AddressTranslator {
    return new AddressTranslator(this._config)
  }

  private getDepositionLockArgs(
    ownerLockHash: Hash,
    layer2_lock_args: HexString,
    cancelTimeout: PackedSince = "0xc00000000002a300"
  ): DepositionLockArgs {
    const rollup_type_hash = getRollupTypeHash(
      this._config.rollup_type_script as Script
    );
    const depositionLockArgs: DepositionLockArgs = {
      owner_lock_hash: ownerLockHash,
      layer2_lock: {
        code_hash: this._deploymentConfig.eth_account_lock.code_hash,
        hash_type: this._deploymentConfig.eth_account_lock.hash_type as
          | "data"
          | "type",
        args: rollup_type_hash + layer2_lock_args.slice(2),
      },
      cancel_timeout: cancelTimeout, // relative timestamp, 2 days
    };
    return depositionLockArgs;
  }

  getLayer2DepositAddressByOwnerLock(ownerLockHashLayerOne: string, ethLockArgsLayerTwo: string): string {
    const depositionLockArgs: DepositionLockArgs = this.getDepositionLockArgs(
      ownerLockHashLayerOne,
      ethLockArgsLayerTwo
    );

    const serializedArgs: HexString = serializeArgs(
      depositionLockArgs,
      this._config.rollup_type_script as Script
    );
    const depositionLock: Script = generateDepositionLock(
      this._deploymentConfig,
      serializedArgs
    );

    return this._provider.parseToAddress(depositionLock);
  }

  async getDefaultLockLayer2DepositAddress(ckbAddress: string, ethAddress: string) {
    return this.getLayer2DepositAddressByOwnerLock(this.ckbAddressToLockScriptHash(ckbAddress), ethAddress);
  }

  async getLayer2DepositAddress(ethAddress: string): Promise<string> {
    try {
      this._provider.config;
    } catch (error) {
      throw new Error('<AddressTranslator>._provider.config is empty. Did you call <AddressTranslator>.init() function?');
    }

    const address = this.ethAddressToCkbAddress(ethAddress);
    const lockScript = this._provider.parseToScript(address);
    const ownerLockHash = utils.computeScriptHash(lockScript);

    return this.getLayer2DepositAddressByOwnerLock(ownerLockHash, ethAddress);
  }

  ethAddressToCkbAddress(
    ethAddress: HexString,
  ): HexString {
    // omni flag       pubkey hash   omni lock flags
    // chain identity   eth addr      function flag()
    // 00: Nervos       👇            00: owner
    // 01: Ethereum     👇            01: administrator
    //      👇          👇            👇
    // args: `0x01${ethAddr.substring(2)}00`,
    const address = this._provider.parseToAddress(this._provider.newScript('RC_LOCK', `0x01${ethAddress.substring(2)}00`));

    return address;
  }

  ethAddressToGodwokenShortAddress(ethAddress: HexString): HexString {
    if (ethAddress.length !== 42 || !ethAddress.startsWith("0x")) {
      throw new Error("eth address format error!");
    }

    const layer2EthLockHash = this.getLayer2EthLockHash(ethAddress)
    const shortAddress = layer2EthLockHash.slice(0, 42);

    return shortAddress;
  }

  /** Call a CKB send transaction from L1-L2 to create an account if it not exist.
   * Require for user to have ~470 ckb on L1
   * Need to be called in web with metamask installed */
  /** Local CKB has no default PWCore, no creation of Layer2 PW Address */
  async createLayer2Address(ethereumAddress: HexString, depositAmountInCkb = '400'): Promise<string> {
    const minimumCkbAmount = (BigInt(depositAmountInCkb) + BigInt('62')).toString();

    await this.assertMinimumBalanceOfCkb(minimumCkbAmount);
   
    const l2Address = await this.getLayer2DepositAddress(
      ethereumAddress
    );

    return this.sendCKB(depositAmountInCkb, l2Address);
  }

  getLayer2EthLockHash(
    ethAddress: string,
  ): string {
    const layer2Lock: Script = {
      code_hash: this._config.eth_account_lock_script_type_hash,
      hash_type: "type",
      args: this._config.rollup_type_hash + ethAddress.slice(2).toLowerCase(),
    };

    const layer2LockHash = utils.computeScriptHash(layer2Lock);

    return layer2LockHash;
  }

  ckbAddressToLockScriptHash(address: CkbAddress): HexString {
    const lock = this._provider.parseToScript(address);
    const accountLockScriptHash = utils.computeScriptHash(lock);
    return accountLockScriptHash;
  }
}
