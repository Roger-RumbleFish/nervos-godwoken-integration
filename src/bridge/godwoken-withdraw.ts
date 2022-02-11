import { Cell, Script, utils } from "@ckb-lumos/lumos";
import { helpers } from "@ckitjs/ckit";
import { Godwoker, RequireResult } from "@polyjuice-provider/base";
import { SerializeWithdrawalRequest } from "@polyjuice-provider/godwoken/schemas";
import { Reader } from "ckb-js-toolkit";
import { AddressTranslator } from "..";
import { WalletBase } from "../wallet-base";
import { NormalizeWithdrawalRequest } from "./utils/base/normalizers";
import { generateWithdrawalRequest } from "./utils/transaction";
import {
  minimalWithdrawalCapacity,
  WithdrawalRequest,
} from "./utils/withdrawal";
import { core } from "@polyjuice-provider/godwoken";
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

export type { GwUnlockBuilderCellDep, WithdrawalRequest, Script };

export class GodwokenWithdraw extends WalletBase {
  constructor(public config: GodwokenWithdrawConfig, public addressTranslator: AddressTranslator) {
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
      const withdrawal_lock_args_data = "0x" + lock_args.slice(66);
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
        .getWithdrawalBlockNumber()
        .toLittleEndianBigUint64();

      withdrawalCells.push({
        cell,
        withdrawalBlockNumber,
        amount: BigInt(parseInt(cell.cell_output.capacity, 16)),
      });
    }

    return withdrawalCells.sort((a, b) =>
      Number(a.withdrawalBlockNumber - b.withdrawalBlockNumber)
    );
  }

  async withdraw(fromEthereumAddress: string, amount: string, godwokenRpcUrl: string): Promise<string | undefined> {
    const { rollupTypeHash, ethAccountLockScriptTypeHash, creatorAccountId, polyjuiceValidatorScriptCodeHash } = this.config;

    const minimum = CkbAmount.fromShannon(
      minimalWithdrawalCapacity(false),
    );
    const desiredAmount = CkbAmount.fromCkb(amount);

    if (desiredAmount.lt(minimum)) {
      throw new Error(`Too low amount to withdraw. Minimum is: ${minimum.toString()} CKB.`);
    }

    const godwoker = new Godwoker(godwokenRpcUrl);
    await godwoker.init();

    const fromId = await godwoker.getAccountIdByEoaEthAddress(
      fromEthereumAddress
    );

    const capacity =
      "0x" +
      (BigInt(400) * BigInt(Math.pow(10, 8))).toString(16).padStart(16, "0");
    const address = this.addressTranslator.ethAddressToCkbAddress(fromEthereumAddress);
    const lockScript = this._provider.parseToScript(address);
    const ownerLockHash = utils.computeScriptHash(lockScript);
    const fee = {
      sudt_id: "0x1",
      amount: "0x0",
    };

    const withdrawalConfig = {
      rollupTypeHash: rollupTypeHash,
      polyjuice: {
        ethAccountLockCodeHash: ethAccountLockScriptTypeHash,
        creatorAccountId,
        scriptCodeHash: polyjuiceValidatorScriptCodeHash,
      },
    };

    const request = await generateWithdrawalRequest(
      godwoker,
      fromEthereumAddress,
      {
        fromId,
        capacity,
        amount: "0x0",
        ownerLockHash,
        fee,
      },
      {
        config: withdrawalConfig,
      }
    );

    const normalizedRequest = NormalizeWithdrawalRequest(request);

    const data = new Reader(
      SerializeWithdrawalRequest(normalizedRequest)
    ).serializeJson();

    const response = await godwoker.jsonRPC(
      "gw_submit_withdrawal_request",
      [data],
      "",
      RequireResult.canBeEmpty
    );

    return response?.result;
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
      .toLittleEndianBigUint64();

    return { rollupCell, lastFinalizedBlockNumber };
  }

  async unlock(
    request: WithdrawalRequest,
    ownerEthereumAddress: string
  ): Promise<string> {
    const { rollupCell } = await this.getRollupCellWithState();

    if (!rollupCell?.out_point) {
      throw new Error("Rollup cell missing.");
    }

    if (!this._signer) {
      throw new Error('Signer is undefined. Make sure to .connectWallet()');
    }

    const ckbAddressAsString = this.addressTranslator.ethAddressToCkbAddress(ownerEthereumAddress);

    const builder = new GodwokenUnlockBuilder(
      ckbAddressAsString,
      request,
      this._provider,
      '10000',
      this.config.withdrawalLockCellDep,
      {
        depType: 'code',
        tx_hash: rollupCell.out_point.tx_hash,
        index: rollupCell.out_point.index
      },
      {
        depType: this._provider.config.SCRIPTS.SECP256K1_BLAKE160.DEP_TYPE,
        tx_hash: this._provider.config.SCRIPTS.SECP256K1_BLAKE160.TX_HASH,
        index: this._provider.config.SCRIPTS.SECP256K1_BLAKE160.INDEX,
      },
      {
        depType: this._provider.config.SCRIPTS.RC_LOCK.DEP_TYPE,
        tx_hash: this._provider.config.SCRIPTS.RC_LOCK.TX_HASH,
        index: this._provider.config.SCRIPTS.RC_LOCK.INDEX,
      }
    );
    
    const tx = await builder.build();
    tx.validate();
    const signedTx = await this._signer.seal(tx);
    signedTx.witnesses[0] = builder.getWithdrawalWitnessArgs();
    const txHash = await this._provider.sendTransaction(signedTx);

    return txHash;
  }
}