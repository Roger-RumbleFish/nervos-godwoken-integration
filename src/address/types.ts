import { Script, Hash, PackedSince } from "@ckb-lumos/base";

export { ChainID as PortalWalletChainID } from "@lay2/pw-core";
export type { Config as PortalWalletConfig } from "@lay2/pw-core";

export interface DepositionLockArgs {
  owner_lock_hash: Hash;
  layer2_lock: Script;
  cancel_timeout: PackedSince;
}

export interface IAddressTranslatorConfig {
  CKB_URL: string;
  RPC_URL: string;
  INDEXER_URL: string;
  deposit_lock_script_type_hash: string;
  eth_account_lock_script_type_hash: string;
  rollup_type_script: {
    code_hash: string;
    hash_type: string;
    args: string;
  };
  rollup_type_hash: string;
  portal_wallet_lock_hash: string;
}
