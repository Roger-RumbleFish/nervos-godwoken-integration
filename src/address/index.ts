import {
  Script,
  HexString,
  utils,
  Address as CkbAddress,
  BI,
  toolkit,
} from "@ckb-lumos/lumos";
import { helpers } from "@ckitjs/ckit";

import defaultConfig from "../config/config.json";
import { IAddressTranslatorConfig } from "./types";
import { DeploymentConfig } from "../config/types";
import {
  delay,
  generateDeployConfig,
} from "./helpers";
import { WalletAssetsSender } from "../wallet-assets-sender";
import { RPC } from "ckb-js-toolkit";
import { V1DepositLockArgs } from "../bridge/utils/godwoken/schemas/codecV1";

const { CkbAmount } = helpers;

export class AddressTranslator extends WalletAssetsSender {
  public _config: IAddressTranslatorConfig;

  private _deploymentConfig: DeploymentConfig;

  private _ckbRpc: RPC;

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

    this._ckbRpc = new RPC(this._config.RPC_URL);
  }

  public clone(): AddressTranslator {
    return new AddressTranslator(this._config);
  }

  private generateDepositLock(ownerLockHashLayerOne: string, ethAddress: string): Script {
    const layer2Lock: Script = {
      code_hash: this._config.eth_account_lock_script_type_hash,
      hash_type: "type",
      args:
        this._config.rollup_type_hash + ethAddress.slice(2).toLowerCase(),
    };

    const depositLockArgs = {
      owner_lock_hash: ownerLockHashLayerOne,
      layer2_lock: layer2Lock,
      cancel_timeout: BI.from("0xc000000000093a81"),
      registry_id: 2,
    };

    const depositLockArgsHexString: HexString = new toolkit.Reader(
      V1DepositLockArgs.pack(depositLockArgs),
    ).serializeJson();

    return {
      code_hash: this._deploymentConfig.deposition_lock.code_hash,
      hash_type: this._deploymentConfig.deposition_lock.hash_type,
      args: this._config.rollup_type_hash + depositLockArgsHexString.slice(2),
    };
  }

  getLayer2DepositAddressByOwnerLock(
    ownerLockHashLayerOne: string,
    ethLockArgsLayerTwo: string
  ): string {
    const depositLock = this.generateDepositLock(ownerLockHashLayerOne, ethLockArgsLayerTwo);
    return this._provider.parseToAddress(depositLock);
  }

  async getDefaultLockLayer2DepositAddress(
    ckbAddress: string,
    ethAddress: string
  ) {
    return this.getLayer2DepositAddressByOwnerLock(
      this.ckbAddressToLockScriptHash(ckbAddress),
      ethAddress
    );
  }

  async getLayer2DepositAddress(ethAddress: string): Promise<string> {
    try {
      this._provider.config;
    } catch (error) {
      throw new Error(
        "<AddressTranslator>._provider.config is empty. Did you call <AddressTranslator>.init() function?"
      );
    }

    const address = this.ethAddressToCkbAddress(ethAddress);
    const lockScript = this._provider.parseToScript(address);
    const ownerLockHash = utils.computeScriptHash(lockScript);

    return this.getLayer2DepositAddressByOwnerLock(ownerLockHash, ethAddress);
  }

  ethAddressToCkbAddress(ethAddress: HexString): HexString {
    // omni flag       pubkey hash   omni lock flags
    // chain identity   eth addr      function flag()
    // 00: Nervos       👇            00: owner
    // 01: Ethereum     👇            01: administrator
    //      👇          👇            👇
    // args: `0x01${ethAddr.substring(2)}00`,
    const address = this._provider.parseToAddress(
      this._provider.newScript("RC_LOCK", `0x01${ethAddress.substring(2)}00`)
    );

    return address;
  }

  ethAddressToGodwokenShortAddress(ethAddress: HexString): HexString {
    if (ethAddress.length !== 42 || !ethAddress.startsWith("0x")) {
      throw new Error("eth address format error!");
    }

    const layer2EthLockHash = this.getLayer2EthLockHash(ethAddress);
    const shortAddress = layer2EthLockHash.slice(0, 42);

    return shortAddress;
  }

  /** Call a CKB send transaction from L1-L2 to create an account if it not exist.
   * Require for user to have ~470 ckb on L1
   * Need to be called in web with metamask installed */
  /** Local CKB has no default PWCore, no creation of Layer2 PW Address */
  async createLayer2Address(
    ethereumAddress: HexString,
    depositAmountInCkb = "400"
  ): Promise<string> {
    const depositAmountInShannons =
      CkbAmount.fromCkb(depositAmountInCkb).toString();

    const minimumCkbAmount = (
      BigInt(depositAmountInCkb) + BigInt("62")
    ).toString();

    const minimumAmountInShannons =
      CkbAmount.fromCkb(minimumCkbAmount).toString();

    await this.assertMinimumBalanceOfCkb(minimumAmountInShannons);

    const l2Address = await this.getLayer2DepositAddress(ethereumAddress);

    return this.sendCKB(depositAmountInShannons, l2Address);
  }

  async checkLayer2AccountExist(ethereumAddress: HexString): Promise<boolean> {
    const script: Script = {
      code_hash: this._config.eth_account_lock_script_type_hash,
      hash_type: "type",
      args: this._config.rollup_type_hash + ethereumAddress.slice(2),
    };

    const userLockHash = utils.computeScriptHash(script);

    const name = "gw_get_account_id_by_script_hash";

    const result = await this._ckbRpc[name](userLockHash);
    return result !== null;
  }

  async waitForLayer2AccountCreation(
    ethereumAddress: HexString,
    interval: number = 5000,
    timeout?: number
  ): Promise<boolean> {
    let l2AccountCreated = false;
    let time = 0;

    while (!l2AccountCreated) {
      l2AccountCreated = await this.checkLayer2AccountExist(ethereumAddress);
      if (timeout && time > timeout) {
        console.log("timeout");
        throw new Error("Check layer 2 account timeout");
      }

      if (l2AccountCreated) {
        break;
      }

      await delay(interval);

      time += interval;
    }

    return l2AccountCreated;
  }

  getLayer2EthLockHash(ethAddress: string): string {
    const layer2Lock: Script = {
      code_hash: this._config.eth_account_lock_script_type_hash,
      hash_type: "type",
      args: this._config.rollup_type_hash + ethAddress.slice(2).toLowerCase(),
    };

    return utils.computeScriptHash(layer2Lock);
  }

  ckbAddressToLockScriptHash(address: CkbAddress): HexString {
    const lock = this._provider.parseToScript(address);

    return utils.computeScriptHash(lock);
  }
}
