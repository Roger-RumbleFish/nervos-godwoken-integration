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
import { Script, HexString, utils, Hash, PackedSince } from "@ckb-lumos/base";
import defaultConfig from "../config/config.json";
import { DepositionLockArgs, IAddressTranslatorConfig } from "./types";
import { DeploymentConfig } from "../config/types";

import {
  asyncSleep,
  generateDeployConfig,
  generateDepositionLock,
  getRollupTypeHash,
  serializeArgs,
} from "./helpers";
import { generateAddress } from "@ckb-lumos/helpers";
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

  async getLayer2DepositAddress(web3: any, ethAddr: string): Promise<Address> {
    let provider: Provider;

    if (await this.checkDefaultWeb3AccountPresent(web3)) {
      provider = new Web3ModalProvider(web3);
    } else {
      provider = new RawProvider(
        "0x23211b1f333aece687eebc5b90be6b55962f5bf0433edd23e1c73d93a67f70e5"
      );
    }

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

    const layer2Lock: Script = {
      code_hash: this._config.eth_account_lock_script_type_hash,
      hash_type: "type",
      args: this._config.rollup_type_hash + ethAddress.slice(2).toLowerCase(),
    };

    const scriptHash = utils.computeScriptHash(layer2Lock);
    const shortAddress = scriptHash.slice(0, 42);

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

    const layer2depositAddress = await this.getLayer2DepositAddress(
      web3Provider,
      ethereumAddress
    );

    const sudt = new SUDT(tokenAddress);

    const builder = new SimpleSUDTBuilder(
      sudt,
      layer2depositAddress,
      SUDT_AMOUNT_TO_SEND,
      options
    );

    return builder;
  }

  async transferFromLayer1ToLayer2(
    web3Provider: Web3,
    ethereumAddress: HexString,
    tokenAddress: string,
    amount: string
  ): Promise<string> {
    // aka Type Script arguments. You should find it in Layer 1 explorer SUDT Cell info.
    // const SUDT_ISSUER_LOCK_HASH =
    //   "0xc43009f083e70ae3fee342d59b8df9eec24d669c1c3a3151706d305f5362c37e";
    // console.log("jestem");
    const SUDT_AMOUNT_TO_SEND = new Amount(amount, AmountUnit.ckb);
    const MINIMUM_CKB_CELL_OUTPUT = new Amount("400", AmountUnit.ckb);

    // const polyjuiceConfig = {
    //   web3Url: this._config.RPC_URL,
    // };

    // console.log("przed polyjuice http");
    // const polyjuiceProvider = new PolyjuiceHttpProvider(
    //   this._config.RPC_URL,
    //   polyjuiceConfig
    // );

    // console.log("po polyjuice http");

    // const web3Provider = new Web3(polyjuiceProvider);
    // console.log("przed stworzeniem deposit address");
    // const layer2depositAddress = await this.getLayer2DepositAddress(
    //   null as any,
    //   ethereumAddress
    // );

    // console.log("stworzyłem deposit address");

    // const collector = new IndexerCollector(this._config.INDEXER_URL);
    // console.log("stworzyłem collectora");
    // const pwCore = await new PWCore(this._config.CKB_URL).init(
    //   new EthProvider(),
    //   collector
    // );

    console.log("provider created");

    // const polyjuiceConfig = {
    //   web3Url: this._config.RPC_URL,
    // };

    // const polyjuiceProvider = new PolyjuiceHttpProvider(
    //   this._config.RPC_URL,
    //   polyjuiceConfig
    // );

    // const web3Provider = new Web3(polyjuiceProvider);

    const layer2depositAddress = await this.getLayer2DepositAddress(
      web3Provider,
      ethereumAddress
    );

    // console.log(
    //   `Deposit to Layer 2 address on Layer 1: \n${layer2depositAddress.addressString}`
    // );

    let provider: Provider;

    // TODO move to a function
    if (await this.checkDefaultWeb3AccountPresent(web3Provider)) {
      provider = new Web3ModalProvider(web3Provider);
    } else {
      throw Error("not connected");
    }

    const collector = new IndexerCollector(this._config.INDEXER_URL);
    const pwCore = await new PWCore(this._config.CKB_URL).init(
      provider,
      collector
    );

    const ckbAddress = provider.address;

    // const ckbAddress = new Address(
    //   "0x66ab6d9362d4f35596279692f0251db635165871",
    //   0,
    //   undefined
    // );

    console.log(`Transferring from CKB address: ${ckbAddress.toCKBAddress()}`);

    const sudt = new SUDT(tokenAddress);
    const sudtBalance = await collector.getSUDTBalance(sudt, ckbAddress);

    const options = {
      witnessArgs: Builder.WITNESS_ARGS.RawSecp256k1,
      autoCalculateCapacity: true,
      minimumOutputCellCapacity: MINIMUM_CKB_CELL_OUTPUT,
    };

    console.log(`SUDT balance: ${sudtBalance}`);

    if (sudtBalance.lt(SUDT_AMOUNT_TO_SEND)) {
      throw Error(
        `
            You don't have enough SUDT balance.
            Required balance: "${SUDT_AMOUNT_TO_SEND.toString()}".
            Your balance: "${sudtBalance.toString()}".
            Try sending more SUDT tokens to your Layer 1 address: "${
              ckbAddress.addressString
            }".    
        `
      );
    }

    const layer1TxHash = await pwCore.sendSUDT(
      sudt,
      layer2depositAddress,
      SUDT_AMOUNT_TO_SEND,
      true,
      undefined,
      options
    );

    return layer1TxHash;
  }

  // private async transactionConfirmed(txHash: string, rpc: RPC) {
  //   const timeout = 18;

  //   for (let index = 0; index < timeout; index++) {
  //     const data = await rpc.get_transaction(txHash);
  //     const status = data.tx_status.status;

  //     console.log(
  //       `tx ${txHash} is ${status}, waited for ${index * 10} seconds`
  //     );

  //     await asyncSleep(10000);
  //     if (status === "committed") {
  //       return;
  //     }
  //   }

  //   throw new Error(`tx ${txHash} not committed in ${timeout * 10} seconds`);
  // }

  private async checkDefaultWeb3AccountPresent(web3: any) {
    const accounts = await web3?.eth?.getAccounts();

    return Boolean(accounts?.[0]);
  }
}
