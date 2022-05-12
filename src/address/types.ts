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
  rc_lock_script_type_hash: string;
}
