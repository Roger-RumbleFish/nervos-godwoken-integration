import { Script } from "@ckb-lumos/lumos";

export interface DeploymentConfig {
  deposition_lock: Script;
  eth_account_lock: Script;
}
