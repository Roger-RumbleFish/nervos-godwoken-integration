import PWCore, {
  Address,
  AddressType,
  IndexerCollector,
  Script as PwScript,
  Web3ModalProvider,
} from "@lay2/pw-core";
import { Script, HexString, utils, Hash, PackedSince } from "@ckb-lumos/base";
import defaultConfig from "../config/config.json";
import { DepositionLockArgs, IAddressTranslatorConfig } from "./types";
import { DeploymentConfig, ROLLUP_TYPE_HASH } from "../config/types";
import {
  generateDeployConfig,
  generateDepositionLock,
  getRollupTypeHash,
  serializeArgs,
} from "./helpers";

export class AddressTranslator {
  private _config: IAddressTranslatorConfig;
  private _deploymentConfig: DeploymentConfig;

  constructor(config?: IAddressTranslatorConfig) {
    if (config) {
      this._config = config;
    } else {
      this._config = {
        CKB_URL: defaultConfig.ckb_url,
        INDEXER_URL: defaultConfig.indexer_url,
        deposit_lock_script_type_hash:
          defaultConfig.deposit_lock.script_type_hash,
        eth_account_lock_script_type_hash:
          defaultConfig.eth_account_lock.script_type_hash,
        rollup_type_script: defaultConfig.chain.rollup_type_script,
      };
    }

    this._deploymentConfig = generateDeployConfig(
      this._config.deposit_lock_script_type_hash,
      this._config.eth_account_lock_script_type_hash
    );
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

  async getLayer2DepositAddress(web3: any, ethAddr: string): Promise<Address> {
    const provider = new Web3ModalProvider(web3);
    const collector = new IndexerCollector(this._config.INDEXER_URL);
    await new PWCore(this._config.CKB_URL).init(provider, collector);

    const pwAddr = new Address(ethAddr, AddressType.eth);
    const ownerLockHash = pwAddr.toLockScript().toHash();
    const depositionLockArgs: DepositionLockArgs = this.getDepositionLockArgs(
      ownerLockHash,
      pwAddr.lockArgs!
    );

    const serializedArgs: HexString = serializeArgs(
      depositionLockArgs,
      this._config.rollup_type_script as Script
    );
    const depositionLock: Script = generateDepositionLock(
      this._deploymentConfig,
      serializedArgs
    );

    const script = PwScript.fromRPC(depositionLock) as unknown as PwScript;

    const depositAddr = Address.fromLockScript(script);

    return depositAddr;
  }

  ethAddressToGodwokenShortAddress(ethAddress: HexString): HexString {
    if (ethAddress.length !== 42 || !ethAddress.startsWith("0x")) {
      throw new Error("eth address format error!");
    }

    const deploymentConfig = generateDeployConfig(
      this._config.deposit_lock_script_type_hash,
      this._config.eth_account_lock_script_type_hash
    );

    const layer2Lock: Script = {
      code_hash: deploymentConfig.eth_account_lock.code_hash,
      hash_type: deploymentConfig.eth_account_lock.hash_type as "data" | "type",
      args: ROLLUP_TYPE_HASH + ethAddress.slice(2).toLowerCase(),
    };
    const scriptHash = utils.computeScriptHash(layer2Lock);
    const shortAddress = scriptHash.slice(0, 42);
    return shortAddress;
  }
}
