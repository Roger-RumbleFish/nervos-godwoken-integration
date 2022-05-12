import { RPC } from "ckb-js-toolkit";
import { Hash, HexString, Script } from "@ckb-lumos/base";
import {
  Uint128,
  Uint32,
  LastL2BlockCommittedInfo,
} from "./types";
export * from "./types";

import * as core from "./schema_v1";
import * as normalizer from "./normalizer";
export { core, normalizer };

export function numberToUInt32LE(value: number): HexString {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return `0x${buf.toString("hex")}`;
}

export function UInt32LEToNumber(hex: HexString): number {
  const buf = Buffer.from(hex.slice(2, 10), "hex");
  return buf.readUInt32LE(0);
}

export function u32ToHex(value: number): HexString {
  return `0x${value.toString(16)}`;
}

export function hexToU32(hex: HexString): number {
  // return parseInt(hex.slice(2), "hex");
  return +hex;
}

export function toBuffer(ab: ArrayBuffer): Buffer {
  const buf = Buffer.alloc(ab.byteLength);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

export function toArrayBuffer(buf: Buffer) {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

export class Godwoken {
  private rpc: RPC;

  constructor(url: string) {
    this.rpc = new RPC(url);
  }

  /**
   * chain_id: u64 = (compatible_chain_id << 32) | creator_id
   * 
   * e.g. 0x315DA00000005 = 868,450,977,185,797
   */
  async getChainId(): Promise<string> {
    const result = await this.rpc['eth_chainId']();
    return result;
  }

  private async rpcCall(method_name: string, ...args: any[]): Promise<any> {
    const name = "gw_" + method_name;
    const result = await this.rpc[name](...args);
    return result;
  }

  async submitWithdrawalRequest(data: HexString): Promise<Hash> {
    return await this.rpcCall("submit_withdrawal_request", data);
  }

  // TODO
  // async function getWithdrawal(withdrawalHash: Hash) {
  //   withdrawal_hash
  // }

  async getScriptHashByShortAddress(address: HexString): Promise<Hash> {
    return await this.rpcCall("get_script_hash_by_short_address", address);
  }

  // TODO: maybe swap params later?
  async getBalance(sudt_id: Uint32, address: HexString): Promise<Uint128> {
    const sudt_id_hex = `0x${(+sudt_id).toString(16)}`;
    const balance = await this.rpcCall("get_balance", address, sudt_id_hex);
    return BigInt(balance);
  }

  async getBalanceById(sudt_id: Uint32, account_id: Uint32): Promise<Uint128> {
    const scriptHash = await this.getScriptHash(account_id);
    const address = scriptHash.slice(0, 42);
    const balance = await this.getBalance(sudt_id, address);
    return balance;
  }

  async getStorageAt(account_id: Uint32, key: Hash): Promise<Hash> {
    const account_id_hex = `0x${account_id.toString(16)}`;
    return await this.rpcCall("get_storage_at", account_id_hex, key);
  }

  async getAccountIdByScriptHash(
    script_hash: Hash
  ): Promise<Uint32 | undefined> {
    const id = await this.rpcCall("get_account_id_by_script_hash", script_hash);
    return id ? +id : undefined;
  }

  async getNonce(account_id: Uint32): Promise<Uint32> {
    const account_id_hex = `0x${account_id.toString(16)}`;
    const nonce = await this.rpcCall("get_nonce", account_id_hex);
    return parseInt(nonce);
  }

  async getScript(script_hash: Hash): Promise<Script> {
    return await this.rpcCall("get_script", script_hash);
  }

  async getScriptHash(account_id: Uint32): Promise<Hash> {
    const account_id_hex = `0x${account_id.toString(16)}`;
    return await this.rpcCall("get_script_hash", account_id_hex);
  }

  async getData(data_hash: Hash): Promise<HexString> {
    return await this.rpcCall("get_data", data_hash);
  }

  async hasDataHash(data_hash: Hash): Promise<boolean> {
    return await this.rpcCall("get_data_hash", data_hash);
  }

  async getTransactionReceipt(l2_tx_hash: Hash) {
    return await this.rpcCall("get_transaction_receipt", l2_tx_hash);
  }

  async getLastSubmittedInfo(): Promise<LastL2BlockCommittedInfo> {
    return await this.rpcCall("get_last_submitted_info");
  }
}
