import { Hash, Script } from "@ckb-lumos/base";
import config from "./config.json";

export interface DeploymentConfig {
  deposition_lock: Script;
  eth_account_lock: Script;
}

export const ROLLUP_TYPE_HASH: Hash = config.rollup_script_hash;
