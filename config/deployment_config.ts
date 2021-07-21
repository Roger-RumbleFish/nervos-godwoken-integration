import config from "./config.json";
import { Script, Hash } from "@ckb-lumos/base";
import { DeploymentConfig } from "./base";

export const deploymentConfig: DeploymentConfig = {
  deposition_lock: buildScriptFromCodeHash(
    config.deposit_lock.script_type_hash
  ),
  eth_account_lock: buildScriptFromCodeHash(
    config.eth_account_lock.script_type_hash
  ),
};

function buildScriptFromCodeHash(codeHash: string): Script {
  return {
    code_hash: codeHash,
    hash_type: "type",
    args: "0x",
  };
}

export const ROLLUP_TYPE_HASH: Hash = config.genesis.rollup_type_hash;
