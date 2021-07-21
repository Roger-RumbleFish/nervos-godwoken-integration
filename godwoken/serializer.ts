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
