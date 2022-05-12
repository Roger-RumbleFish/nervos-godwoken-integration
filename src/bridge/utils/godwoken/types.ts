import { Hash, Script } from "@ckb-lumos/base";

export type Uint32 = number;
export type Uint64 = bigint;
export type Uint128 = bigint;
export type Uint256 = bigint;

export interface CreateAccount {
  script: Script;
}

export interface Fee {
  sudt_id: Uint32;
  amount: Uint128;
}

export enum Status {
  Running = "running",
  Halting = "halting",
}

export interface LastL2BlockCommittedInfo {
  transaction_hash: Hash;
}