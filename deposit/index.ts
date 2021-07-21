import { Reader } from "ckb-js-toolkit";
import { Script, HexString, Hash, PackedSince, utils } from "@ckb-lumos/base";

import config from "../config/config.json";
import { DeploymentConfig } from "../config/base";
import { deploymentConfig } from "../config/deployment_config";
import { SerializeDepositionLockArgs } from "../godwoken/serializer";
import { NormalizeDepositionLockArgs } from "../godwoken/normalizer";

import { DepositionLockArgs } from "./types";

export function getRollupTypeHash(): HexString {
  const rollupTypeScript: Script = config.chain.rollup_type_script as Script;
  const hash: HexString = utils.computeScriptHash(rollupTypeScript);

  return hash;
}

export function getDepositionLockArgs(
  ownerLockHash: Hash,
  layer2_lock_args: HexString,
  cancelTimeout: PackedSince = "0xc00000000002a300"
): DepositionLockArgs {
  const rollup_type_hash = getRollupTypeHash();
  const depositionLockArgs: DepositionLockArgs = {
    owner_lock_hash: ownerLockHash,
    layer2_lock: {
      code_hash: deploymentConfig.eth_account_lock.code_hash,
      hash_type: deploymentConfig.eth_account_lock.hash_type as "data" | "type",
      args: rollup_type_hash + layer2_lock_args.slice(2),
    },
    cancel_timeout: cancelTimeout, // relative timestamp, 2 days
  };
  return depositionLockArgs;
}

export function generateDepositionLock(
  config: DeploymentConfig,
  args: HexString
): Script {
  return {
    code_hash: config.deposition_lock.code_hash,
    hash_type: config.deposition_lock.hash_type,
    args: args,
  };
}

export function serializeArgs(args: DepositionLockArgs): HexString {
  const rollup_type_hash: Hash = getRollupTypeHash();
  const serializedDepositionLockArgs: ArrayBuffer = SerializeDepositionLockArgs(
    NormalizeDepositionLockArgs(args)
  );

  const depositionLockArgsStr: HexString = new Reader(
    serializedDepositionLockArgs
  ).serializeJson();

  return rollup_type_hash + depositionLockArgsStr.slice(2);
}
