import { Script } from "@ckb-lumos/base";

export interface DeploymentConfig {
  deposition_lock: Script;
  eth_account_lock: Script;
}
