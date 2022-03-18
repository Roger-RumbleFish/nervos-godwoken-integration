import { Cell, Hash, HexNumber, HexString } from "@ckb-lumos/base";
import { minimalCellCapacity } from "@ckb-lumos/helpers";
import { Reader } from "ckb-js-toolkit";
import { WithdrawalLockArgs } from "./godwoken";
import { NormalizeWithdrawalLockArgs } from "./godwoken/normalizer";
import { SerializeWithdrawalLockArgs } from "./godwoken/schema_v1";

export interface WithdrawalRequest {
  amount: bigint;
  withdrawalBlockNumber: bigint;
  cell: Cell;
}

export interface WithdrawalRequestFromApi {
  withdrawal: {
    request: {
      nonce: HexNumber;
      capacity: HexNumber;
      amount: HexNumber;
      sudt_script_hash: HexString;
      owner_lock_hash: HexString;
      chain_id: HexNumber;
      fee: HexNumber;
    };
    owner_lock: {};
  };
  status: 'committed';
}

export function minimalWithdrawalCapacity(isSudt: boolean): HexNumber {
  // fixed size, the specific value is not important.
  const dummyHash: Hash = "0x" + "00".repeat(32);
  const dummyHexNumber: HexNumber = "0x0";
  const dummyRollupTypeHash: Hash = dummyHash;

  const dummyWithdrawalLockArgs: WithdrawalLockArgs = {
    account_script_hash: dummyHash,
    withdrawal_block_hash: dummyHash,
    withdrawal_block_number: dummyHexNumber,
    sudt_script_hash: dummyHash,
    sell_amount: dummyHexNumber,
    sell_capacity: dummyHexNumber,
    owner_lock_hash: dummyHash,
    payment_lock_hash: dummyHash,
  };

  const serialized: HexString = new Reader(
    SerializeWithdrawalLockArgs(
      NormalizeWithdrawalLockArgs(dummyWithdrawalLockArgs)
    )
  ).serializeJson();

  const args = dummyRollupTypeHash + serialized.slice(2);

  const lock: any = {
    code_hash: dummyHash,
    hash_type: "data",
    args,
  };

  let type: any = undefined;
  let data = "0x";
  if (isSudt) {
    type = {
      code_hash: dummyHash,
      hash_type: "data",
      args: dummyHash,
    };
    data = "0x" + "00".repeat(16);
  }

  const cell: Cell = {
    cell_output: {
      lock,
      type,
      capacity: dummyHexNumber,
    },
    data,
  };

  const capacity: bigint = minimalCellCapacity(cell);

  return "0x" + capacity.toString(16);
}

