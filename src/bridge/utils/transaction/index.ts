import { Script } from "@ckb-lumos/base";
import { RawWithdrawalRequestV1 } from "../godwoken";

export function generateWithdrawalMessage(
  rawRequest: RawWithdrawalRequestV1,
  ownerLockScript: Script
) {
  const typedMsg = {
    domain: {
      name: "Godwoken",
      version: "1",
      chainId: Number(rawRequest.chain_id),
    },
    message: {
      accountScriptHash: rawRequest.account_script_hash,
      nonce: Number(rawRequest.nonce),
      chainId: Number(rawRequest.chain_id),
      fee: Number(rawRequest.fee),
      layer1OwnerLock: {
        codeHash: ownerLockScript.code_hash,
        hashType: ownerLockScript.hash_type,
        args: ownerLockScript.args,
      },
      withdraw: {
        ckbCapacity: Number(rawRequest.capacity),
        UDTAmount: Number(rawRequest.amount),
        UDTScriptHash: rawRequest.sudt_script_hash,
      }
    },
    primaryType: "Withdrawal" as const,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      Withdrawal: [
        { name: "accountScriptHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "layer1OwnerLock", type: "Script" },
        { name: "withdraw", type: "WithdrawalAsset" },
      ],
      Script: [
        { name: "codeHash", type: "bytes32" },
        { name: "hashType", type: "string" },
        { name: "args", type: "bytes" },
      ],
      WithdrawalAsset: [
        { name: "ckbCapacity", type: "uint256" },
        { name: "UDTAmount", type: "uint256" },
        { name: "UDTScriptHash", type: "bytes32" },
      ],
    }
  };


  return typedMsg;
}