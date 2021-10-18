import { normalizers, Reader } from "ckb-js-toolkit";
import { Script, HexString, Hash, utils } from "@ckb-lumos/base";

import { DeploymentConfig } from "../config/types";
import { DepositionLockArgs } from "./types";

export function getRollupTypeHash(rollup_type_script: Script): HexString {
  const hash: HexString = utils.computeScriptHash(rollup_type_script);

  return hash;
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

export function serializeArgs(
  args: DepositionLockArgs,
  rollup_type_script: Script
): HexString {
  const rollup_type_hash: Hash = getRollupTypeHash(rollup_type_script);
  const serializedDepositionLockArgs: ArrayBuffer = SerializeDepositionLockArgs(
    NormalizeDepositionLockArgs(args)
  );

  const depositionLockArgsStr: HexString = new Reader(
    serializedDepositionLockArgs
  ).serializeJson();

  return rollup_type_hash + depositionLockArgsStr.slice(2);
}

function normalizeHexNumber(length: number) {
  return function (debugPath: string, value: any) {
    if (!(value instanceof ArrayBuffer)) {
      let intValue = BigInt(value).toString(16);
      if (intValue.length % 2 !== 0) {
        intValue = "0" + intValue;
      }
      if (intValue.length / 2 > length) {
        throw new Error(
          `${debugPath} is ${
            intValue.length / 2
          } bytes long, expected length is ${length}!`
        );
      }
      const view = new DataView(new ArrayBuffer(length));
      for (let i = 0; i < intValue.length / 2; i++) {
        const start = intValue.length - (i + 1) * 2;
        view.setUint8(i, parseInt(intValue.substr(start, 2), 16));
      }
      value = view.buffer;
    }
    if (value.byteLength < length) {
      const array = new Uint8Array(length);
      array.set(new Uint8Array(value), 0);
      value = array.buffer;
    }
    return value;
  };
}

function normalizeObject(debugPath: string, obj: any, keys: object) {
  const result: any = {};

  for (const [key, f] of Object.entries(keys)) {
    const value = obj[key];
    if (!value) {
      throw new Error(`${debugPath} is missing ${key}!`);
    }
    result[key] = f(`${debugPath}.${key}`, value);
  }
  return result;
}

function normalizeRawData(length: number) {
  return function (debugPath: string, value: any) {
    value = new Reader(value).toArrayBuffer();
    if (length > 0 && value.byteLength !== length) {
      throw new Error(
        `${debugPath} has invalid length ${value.byteLength}, required: ${length}`
      );
    }
    return value;
  };
}

function toNormalize(normalize: Function) {
  return function (debugPath: string, value: any) {
    return normalize(value, {
      debugPath,
    });
  };
}

function NormalizeDepositionLockArgs(
  args: object,
  { debugPath = "deposition_lock_args" } = {}
) {
  return normalizeObject(debugPath, args, {
    owner_lock_hash: normalizeRawData(32),
    layer2_lock: toNormalize(normalizers.NormalizeScript),
    cancel_timeout: normalizeHexNumber(8),
  });
}

function dataLengthError(actual: any, required: any) {
  throw new Error(
    `Invalid data length! Required: ${required}, actual: ${actual}`
  );
}

function assertArrayBuffer(reader: any) {
  if (reader instanceof Object && reader.toArrayBuffer instanceof Function) {
    reader = reader.toArrayBuffer();
  }
  if (!(reader instanceof ArrayBuffer)) {
    throw new Error(
      "Provided value must be an ArrayBuffer or can be transformed into ArrayBuffer!"
    );
  }
  return reader;
}

function assertDataLength(actual: any, required: any) {
  if (actual !== required) {
    dataLengthError(actual, required);
  }
}

export function serializeTable(buffers: any[]) {
  const itemCount = buffers.length;
  let totalSize = 4 * (itemCount + 1);
  const offsets = [];

  for (let i = 0; i < itemCount; i++) {
    offsets.push(totalSize);
    totalSize += buffers[i].byteLength;
  }

  const buffer = new ArrayBuffer(totalSize);
  const array = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint32(0, totalSize, true);
  for (let i = 0; i < itemCount; i++) {
    view.setUint32(4 + i * 4, offsets[i], true);
    array.set(new Uint8Array(buffers[i]), offsets[i]);
  }
  return buffer;
}

export function SerializeByte32(value: any) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 32);
  return buffer;
}

export function SerializeBytes(value: any) {
  const item = assertArrayBuffer(value);
  const array = new Uint8Array(4 + item.byteLength);
  new DataView(array.buffer).setUint32(0, item.byteLength, true);
  array.set(new Uint8Array(item), 4);
  return array.buffer;
}

export function SerializeUint64(value: any) {
  const buffer = assertArrayBuffer(value);
  assertDataLength(buffer.byteLength, 8);
  return buffer;
}

export function SerializeScript(value: any) {
  const buffers = [];
  buffers.push(SerializeByte32(value.code_hash));
  const hashTypeView = new DataView(new ArrayBuffer(1));
  hashTypeView.setUint8(0, value.hash_type);
  buffers.push(hashTypeView.buffer);
  buffers.push(SerializeBytes(value.args));
  return serializeTable(buffers);
}

export function SerializeDepositionLockArgs(value: any) {
  const buffers = [];
  buffers.push(SerializeByte32(value.owner_lock_hash));
  buffers.push(SerializeScript(value.layer2_lock));
  buffers.push(SerializeUint64(value.cancel_timeout));
  return serializeTable(buffers);
}

function buildScriptFromCodeHash(codeHash: string): Script {
  return {
    code_hash: codeHash,
    hash_type: "type",
    args: "0x",
  };
}

export const generateDeployConfig = (
  depositLockHash: string,
  ethAccountLockHash: string
): DeploymentConfig => {
  return {
    deposition_lock: buildScriptFromCodeHash(depositLockHash),
    eth_account_lock: buildScriptFromCodeHash(ethAccountLockHash),
  };
};

export const asyncSleep = async (ms = 1000) => {
  return new Promise((r) => setTimeout(r, ms));
};
