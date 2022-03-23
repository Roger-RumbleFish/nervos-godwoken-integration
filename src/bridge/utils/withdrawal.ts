import { Cell, HexNumber, HexString } from "@ckb-lumos/base";

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

export function getMinimumWithdrawalCapacity(isSudt: boolean): HexNumber {
  if (isSudt) {
    throw new Error('Not implemented.');
  }

  return `0x${BigInt(25400000000).toString(16)}`;
}

