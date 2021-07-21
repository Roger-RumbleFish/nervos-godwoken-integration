import PWCore, {
  Address,
  AddressType,
  IndexerCollector,
  Script as PwScript,
  Web3ModalProvider,
} from "@lay2/pw-core";
import { Script, HexString, utils } from "@ckb-lumos/base";

import { deploymentConfig, ROLLUP_TYPE_HASH } from "./config/deployment_config";
import {
  generateDepositionLock,
  getDepositionLockArgs,
  serializeArgs,
} from "./deposit";
import { DepositionLockArgs } from "./deposit/types";

const INDEXER_URL = "https://testnet.ckb.dev/indexer";
const CKB_URL = "https://testnet.ckb.dev";

export async function getLayer2DepositAddress(
  web3: any,
  ethAddr: string
): Promise<Address> {
  const provider = new Web3ModalProvider(web3);
  const collector = new IndexerCollector(INDEXER_URL);
  await new PWCore(CKB_URL).init(provider, collector);

  const pwAddr = new Address(ethAddr, AddressType.eth);
  const ownerLockHash = pwAddr.toLockScript().toHash();
  const depositionLockArgs: DepositionLockArgs = getDepositionLockArgs(
    ownerLockHash,
    pwAddr.lockArgs!
  );

  const serializedArgs: HexString = serializeArgs(depositionLockArgs);
  const depositionLock: Script = generateDepositionLock(
    deploymentConfig,
    serializedArgs
  );

  const script = PwScript.fromRPC(depositionLock) as unknown as PwScript;

  const depositAddr = Address.fromLockScript(script);

  return depositAddr;
}

export function ethAddressToGodwokenShortAddress(
  ethAddress: HexString
): HexString {
  if (ethAddress.length !== 42 || !ethAddress.startsWith("0x")) {
    throw new Error("eth address format error!");
  }

  const layer2Lock: Script = {
    code_hash: deploymentConfig.eth_account_lock.code_hash,
    hash_type: deploymentConfig.eth_account_lock.hash_type as "data" | "type",
    args: ROLLUP_TYPE_HASH + ethAddress.slice(2).toLowerCase(),
  };
  const scriptHash = utils.computeScriptHash(layer2Lock);
  const shortAddress = scriptHash.slice(0, 42);
  return shortAddress;
}
