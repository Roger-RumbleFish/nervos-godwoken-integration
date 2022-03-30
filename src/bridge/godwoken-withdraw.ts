import { Cell, Hash, HexNumber, HexString, Script, utils } from "@ckb-lumos/lumos";
import { helpers } from "@ckitjs/ckit";
import { Reader } from "ckb-js-toolkit";
import { AddressTranslator } from "..";
import { WalletBase } from "../wallet-base";
import { generateWithdrawalMessage } from "./utils/transaction";
import {
  minimalWithdrawalCapacity,
  WithdrawalRequest,
  WithdrawalRequestFromApi,
} from "./utils/withdrawal";
import { withdrawal } from "./utils/utils";
import { core, Godwoken, RawWithdrawalRequestV1, WithdrawalRequestExtra, WithdrawalRequestV1 } from "./utils/godwoken";
import GodwokenUnlockBuilder, { GwUnlockBuilderCellDep } from "../builders/GodwokenUnlockBuilder";

const { CkbAmount } = helpers;

export interface GodwokenWithdrawConfig {
  rollupTypeHash: string;
  rollupTypeScript: Script;
  ethAccountLockScriptTypeHash: string;
  creatorAccountId: string;
  polyjuiceValidatorScriptCodeHash: string;
  withdrawalLockScript: Script;
  withdrawalLockCellDep: GwUnlockBuilderCellDep;
}

export type { GwUnlockBuilderCellDep, Script, WithdrawalRequest, WithdrawalRequestFromApi };

export class GodwokenWithdraw extends WalletBase {
  constructor(public godwokenRpcUrl: string, public config: GodwokenWithdrawConfig, public addressTranslator: AddressTranslator) {
    super(addressTranslator._config.CKB_URL, addressTranslator._config.INDEXER_URL);
  }

  async fetchWithdrawalRequests(
    ownerEthereumAddress: string
  ) {
    const ownerLockScriptAsAddress = this.addressTranslator.ethAddressToCkbAddress(ownerEthereumAddress);

    const lock_script = this._provider.parseToScript(ownerLockScriptAsAddress);
    const lock_script_hash = utils.computeScriptHash(lock_script);

    // * search withdrawal locked cell by:
    //   - withdrawal lock code hash
    //   - owner secp256k1 blake2b160 lock hash
    //   - last_finalized_block_number

    const withdrawLock = {
      code_hash: this.config.withdrawalLockScript.code_hash,
      hash_type: this.config.withdrawalLockScript.hash_type,
      args: this.config.rollupTypeHash, // prefix search
    };

    const collectedCells = await this._provider.collectCells({
      searchKey: {
        script: withdrawLock,
        script_type: 'lock'
      },
    }, () => true);

    const withdrawalCells: WithdrawalRequest[] = [];
    for await (const cell of collectedCells) {
      const lock_args = cell.cell_output.lock.args;
      const withdrawal_lock_args_data = "0x" + lock_args.slice(66, 274)

      const withdrawal_lock_args = new core.WithdrawalLockArgs(
        new Reader(withdrawal_lock_args_data)
      );

      const owner_lock_hash = new Reader(
        withdrawal_lock_args.getOwnerLockHash().raw()
      ).serializeJson();

      if (owner_lock_hash !== lock_script_hash) {
        continue;
      }

      const withdrawalBlockNumber = withdrawal_lock_args
        .getWithdrawalBlockNumber();

      withdrawalCells.push({
        cell,
        withdrawalBlockNumber: withdrawalBlockNumber.view.getBigUint64(0, true),
        amount: BigInt(parseInt(cell.cell_output.capacity, 16)),
      });
    }

    return withdrawalCells.sort((a, b) =>
      Number(a.withdrawalBlockNumber - b.withdrawalBlockNumber)
    );
  }

  async fetchWithdrawalRequestById(
    id: string
  ): Promise<WithdrawalRequestFromApi> {
    const godwokenWeb3 = new Godwoken(this.godwokenRpcUrl);
    return (godwokenWeb3 as any).rpcCall("get_withdrawal", id);
  }

  async withdraw(fromEthereumAddress: string, amountInCkb: string): Promise<string | undefined> {
    const minimum = CkbAmount.fromShannon(
      minimalWithdrawalCapacity(false),
    );
    const desiredAmount = CkbAmount.fromCkb(amountInCkb);

    if (desiredAmount.lt(minimum)) {
      throw new Error(`Too low amount to withdraw. Minimum is: ${minimum.toString()} Shannon.`);
    }

    const godwokenWeb3 = new Godwoken(this.godwokenRpcUrl);

    const layer2AccountScriptHash = this.addressTranslator.getLayer2EthLockHash(fromEthereumAddress);
    const fromId = await godwokenWeb3.getAccountIdByScriptHash(layer2AccountScriptHash);

    if (typeof fromId === 'undefined') {
      throw new Error('"fromId" is undefined. Is your Godwoken account created?');
    }

    const nonce: number = await godwokenWeb3.getNonce(fromId!);
    const chainIdAsHex = await godwokenWeb3.getChainId();
    const capacity = "0x" + desiredAmount.toHex().slice(2).padStart(16, "0");
    const address = this.addressTranslator.ethAddressToCkbAddress(fromEthereumAddress);
    const layerOneOwnerLockScript = this._provider.parseToScript(address);
    
    const fee = '0x0';
    const amount = '0x0';

    const withdrawalRequestExtra = await this.generateWithdrawalRequest(
      fromEthereumAddress,
      {
        capacity,
        amount,
        layerOneOwnerLockScript,
        fee,
        nonce,
        chainIdAsHex
      }
    );

    const result = await godwokenWeb3.submitWithdrawalReqV1(withdrawalRequestExtra);

    return result;
  }

  async getRollupCellWithState() {
    // * search rollup cell then get last_finalized_block_number from cell data (GlobalState)
    const rollupCells = await this._provider.collectCells({
      searchKey: {
        script: this.config.rollupTypeScript,
        script_type: 'type',
      }
    }, () => true);

    let rollupCell: Cell | undefined = undefined;
    for await (const cell of rollupCells) {
      const lock = cell.cell_output.lock;
      if (!lock || !cell.out_point) {
        throw new Error("Rollup cell has no lock script or out point.");
      }

      rollupCell = cell;
      break;
    }

    if (rollupCell === null || typeof rollupCell === "undefined") {
      throw new Error("Rollup cell not found.");
    }

    const globalState = new core.GlobalState(new Reader(rollupCell.data));
    const lastFinalizedBlockNumber = globalState
      .getLastFinalizedBlockNumber()
      .view.getBigUint64(0, true)

    return { rollupCell, lastFinalizedBlockNumber };
  }

  protected async generateWithdrawalRequest(
    ethereumAddress: string,
    {
      capacity,
      amount,
      layerOneOwnerLockScript,
      fee,
      nonce,
      chainIdAsHex,
      sudtScriptHash = "0x" + "00".repeat(32),
    }: {
      capacity: HexNumber;
      amount: HexNumber;
      layerOneOwnerLockScript: Script;
      fee: string;
      nonce: number;
      chainIdAsHex: HexNumber;
      sudtScriptHash?: Hash;
    },
    {
      config = {},
    }: {
      config?: any;
    } = {}
  ) {
    const ckbSudtScriptHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
  
    if (config == null) {
      config = {};
    }
  
    const isSudt = sudtScriptHash !== ckbSudtScriptHash;
    let minCapacity = withdrawal.minimalWithdrawalCapacity(isSudt);
    if (BigInt(capacity) < BigInt(minCapacity)) {
      throw new Error(
        `Withdrawal required ${BigInt(
          minCapacity
        )} shannons at least, provided ${BigInt(capacity)}.`
      );
    }
  
    const layer2AccountScriptHash = this.addressTranslator.getLayer2EthLockHash(ethereumAddress);
    const ownerLockHash = utils.computeScriptHash(layerOneOwnerLockScript);

    const rawWithdrawalRequest: RawWithdrawalRequestV1 = {
      chain_id: chainIdAsHex,
      nonce: `0x${nonce.toString(16)}`,
      capacity,
      amount,
      sudt_script_hash: sudtScriptHash,
      account_script_hash: layer2AccountScriptHash,
      owner_lock_hash: ownerLockHash,
      fee
    };
  
    const message = generateWithdrawalMessage(
      rawWithdrawalRequest,
      layerOneOwnerLockScript
    );
  
    const signature: HexString = await this.signTyped(message);
  
    const withdrawalReq: WithdrawalRequestV1 = {
      raw: rawWithdrawalRequest,
      signature
    };
    const withdrawalReqExtra: WithdrawalRequestExtra = {
      request: withdrawalReq,
      owner_lock: layerOneOwnerLockScript
    };
        
    return withdrawalReqExtra;
  }
}