import { Script, Hash, PackedSince } from "@ckb-lumos/base";

export interface DepositionLockArgs {
  owner_lock_hash: Hash;
  layer2_lock: Script;
  cancel_timeout: PackedSince;
}
