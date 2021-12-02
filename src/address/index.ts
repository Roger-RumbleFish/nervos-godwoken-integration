import PWCore, {
  Address,
  AddressType,
  Amount,
  EthProvider,
  IndexerCollector,
  Provider,
  RawProvider,
  Script as PwScript,
  Web3ModalProvider,
  SUDT,
  Builder,
  AmountUnit,
  SimpleSUDTBuilder,
} from "@lay2/pw-core";
import { PolyjuiceHttpProvider } from "@polyjuice-provider/web3";
import { Script, HexString, utils, Hash, PackedSince, Address as CkbAddress } from "@ckb-lumos/base";
import defaultConfig from "../config/config.json";
import { DepositionLockArgs, IAddressTranslatorConfig, PortalWalletChainID, PortalWalletConfig } from "./types";
import { DeploymentConfig } from "../config/types";

import {
  generateDeployConfig,
  generateDepositionLock,
  getRollupTypeHash,
  serializeArgs,
} from "./helpers";
import { generateAddress, parseAddress } from "@ckb-lumos/helpers";
import Web3 from "web3";

export class AddressTranslator {
  private _config: IAddressTranslatorConfig;
  private _deploymentConfig: DeploymentConfig;

  constructor(config?: IAddressTranslatorConfig) {
    if (config) {
      this._config = config;
    } else {
      this._config = {
        CKB_URL: defaultConfig.ckb_url,
        RPC_URL: defaultConfig.rpc_url,
        INDEXER_URL: defaultConfig.indexer_url,
        deposit_lock_script_type_hash:
          defaultConfig.deposit_lock.script_type_hash,
        eth_account_lock_script_type_hash:
          defaultConfig.eth_account_lock.script_type_hash,
        rollup_type_script: defaultConfig.chain.rollup_type_script,
        rollup_type_hash: defaultConfig.rollup_script_hash,
        portal_wallet_lock_hash: defaultConfig.portal_wallet_lock_hash,
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

  async getLayer2DepositAddress(web3: any, ethAddress: string, portalWalletChainId?: PortalWalletChainID, portalWalletConfig?: PortalWalletConfig): Promise<Address> {
    let provider: Provider;

    if (await this.checkDefaultWeb3AccountPresent(web3)) {
      provider = new Web3ModalProvider(web3);
    } else {
      provider = new RawProvider(
        "0x23211b1f333aece687eebc5b90be6b55962f5bf0433edd23e1c73d93a67f70e5"
      );
    }

    const collector = new IndexerCollector(this._config.INDEXER_URL);
    await new PWCore(this._config.CKB_URL).init(provider, collector, portalWalletChainId, portalWalletConfig);

    const pwAddress = new Address(ethAddress, AddressType.eth);
    const ownerLockHash = pwAddress.toLockScript().toHash();
    const depositionLockArgs: DepositionLockArgs = this.getDepositionLockArgs(
      ownerLockHash,
      pwAddress.lockArgs!
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

  ethAddressToCkbAddress(
    ethAddress: HexString,
    isTestnet: boolean = false
  ): HexString {
    const script = {
      code_hash: this._config.portal_wallet_lock_hash,
      hash_type: "type",
      args: ethAddress,
    };
    const { predefined } = require("@ckb-lumos/config-manager");
    const address = generateAddress(
      script as Script,
      isTestnet
        ? {
          config: predefined.AGGRON4,
        }
        : undefined
    );
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
  async createLayer2Address(ethereumAddress: HexString): Promise<HexString> {
    const amount: Amount = new Amount("400", 8);

    const polyjuiceConfig = {
      web3Url: this._config.RPC_URL,
    };

    const polyjuiceProvider = new PolyjuiceHttpProvider(
      this._config.RPC_URL,
      polyjuiceConfig
    );

    const web3Provider = new Web3(polyjuiceProvider);

    const l2Address = await this.getLayer2DepositAddress(
      web3Provider,
      ethereumAddress
    );

    const collector = new IndexerCollector(this._config.INDEXER_URL);
    const pwCore = await new PWCore(this._config.CKB_URL).init(
      new EthProvider(),
      collector
    );

    const tx = await pwCore.send(l2Address, amount);

    return tx;
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

    return layer2LockHash
  }
  
  ckbAddressToLockScriptHash(address: CkbAddress): HexString {
    const lock = parseAddress(address);
    const accountLockScriptHash = utils.computeScriptHash(lock);
    return accountLockScriptHash;
  }
  
  // TODO: Should be moved to bridge layer
  async calculateLayer1ToLayer2Fee(
    web3Provider: Web3,
    ethereumAddress: string,
    tokenAddress: string,
    amount: string
  ): Promise<SimpleSUDTBuilder> {
    const MINIMUM_CKB_CELL_OUTPUT = new Amount("400", AmountUnit.ckb);
    const SUDT_AMOUNT_TO_SEND = new Amount(amount, AmountUnit.ckb);

    const options = {
      witnessArgs: Builder.WITNESS_ARGS.RawSecp256k1,
      autoCalculateCapacity: true,
      minimumOutputCellCapacity: MINIMUM_CKB_CELL_OUTPUT,
    };

    const layer2DepositAddress = await this.getLayer2DepositAddress(
      web3Provider,
      ethereumAddress
    );

    const sudt = new SUDT(tokenAddress);

    const builder = new SimpleSUDTBuilder(
      sudt,
      layer2DepositAddress,
      SUDT_AMOUNT_TO_SEND,
      options
    );

    return builder;
  }

  private async checkDefaultWeb3AccountPresent(web3: any) {
    const accounts = await web3?.eth?.getAccounts();

    return Boolean(accounts?.[0]);
  }
}
