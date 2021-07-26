import { Hash, Script } from "@ckb-lumos/base";
import config from "./config.json";

export interface DeploymentConfig {
  deposition_lock: Script;
  eth_account_lock: Script;
}
