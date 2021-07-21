// import { CKBComponents } from "@nervosnetwork/ckb-types";

export const NERVOS_NETWORK = "Nervos" as const;
export type NetworkKeyNervos = typeof NERVOS_NETWORK;

export enum BridgeTransactionStatus {
  Pending = "Pending",
  Successful = "Successful",
  Failed = "Failed",
}

export type NetworkBase = {
  Network: string;
  UserIdent: string;
  DerivedAssetIdent?: string;
  NativeAssetIdent?: string;
  RawTransaction?: unknown;
  SignedTransaction?: unknown;
};

export type AmountWithoutDecimals = string;

export type FungibleBaseInfo = {
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  shadow: { network: string; ident: string };
};

export type AssetType = {
  network: string;
  ident: string;
  amount?: AmountWithoutDecimals;
  info?: FungibleBaseInfo;
};

export type NetworkTypes<T extends NetworkBase = NetworkBase> = Required<T>;
export type RequiredAsset<T extends keyof AssetType> = AssetType &
  Required<Pick<AssetType, T>>;

export type NervosNetwork = NetworkTypes<{
  Network: NetworkKeyNervos;
  NativeAssetIdent: string;
  DerivedAssetIdent: string;
  UserIdent: string;
  RawTransaction: CKBComponents.RawTransactionToSign;
  SignedTransaction: CKBComponents.RawTransaction;
}>;

// XChain -> Nervos
export type GenerateBridgeInTransactionPayload = {
  asset: RequiredAsset<"amount">;
  recipient: NervosNetwork["UserIdent"];
  // XChain user ident
  sender: string;
};

// Nervos -> XChain
export type GenerateBridgeOutNervosTransactionPayload = {
  // XChain network name
  network: string;
  // XChain asset id
  // TODO refactor key to assetIdent
  asset: string;
  amount: string;
  // XChain User ident
  recipient: string;
  sender: NervosNetwork["UserIdent"];
};

export type TransactionIdent = { txId: string };

export type GenerateTransactionResponse<N extends NetworkTypes> = {
  network: string;
  // TODO
  rawTransaction: N["RawTransaction"];
};

export type SignedTransactionPayload<N extends NetworkBase> = {
  network: N["Network"];
  // TODO
  signedTransaction: N["SignedTransaction"];
};

export type GetBridgeTransactionStatusPayload = {
  network: string;
  txId: string;
};

export type GetBridgeTransactionStatusResponse = {
  network: string;
  status: BridgeTransactionStatus;
};

export type GetBridgeTransactionSummariesPayload = {
  network: string;
  xchainAssetIdent: string;
  user: {
    network: string;
    ident: string;
  };
};

type Timestamp = number;

export type TransactionSummary = {
  txSummary: {
    fromAsset: RequiredAsset<"amount">;
    toAsset: RequiredAsset<"amount">;
    fromTransaction: TransactionIdent & { timestamp: Timestamp } & {
      confirmStatus: "pending" | number | "confirmed";
    };
    toTransaction?: TransactionIdent & { timestamp?: Timestamp };
  };
};

export type FailedTransactionSummary = TransactionSummary & {
  status: BridgeTransactionStatus.Failed;
  message: string;
};
export type UnFailedTransactionSummary = TransactionSummary & {
  status: BridgeTransactionStatus.Pending | BridgeTransactionStatus.Successful;
};

export type TransactionSummaryWithStatus =
  | UnFailedTransactionSummary
  | FailedTransactionSummary;

export type GetBalancePayload = Array<{
  network: string;
  userIdent: string;
  assetIdent: string;
}>;

export type GetBalanceResponse = Array<RequiredAsset<"amount">>;

export interface GetBridgeInNervosBridgeFeePayload {
  network: string;
  xchainAssetIdent: string;
  amount: string;
}

export interface GetBridgeOutNervosBridgeFeePayload {
  network: string;
  xchainAssetIdent: string;
  amount: string;
}

export interface GetBridgeInNervosBridgeFeeResponse {
  fee: RequiredAsset<"amount">;
}

export interface GetBridgeOutNervosBridgeFeeResponse {
  fee: RequiredAsset<"amount">;
}

export interface EthereumConfig {
  contractAddress: string;
}

export interface GetConfigResponse {
  xchains: {
    Ethereum: EthereumConfig;
  };
}

export interface IBridgeRPCHandler {
  /* generate transaction */
  // prettier-ignore
  generateBridgeInNervosTransaction: <T extends NetworkTypes>(payload: GenerateBridgeInTransactionPayload) => Promise<GenerateTransactionResponse<T>>
  // prettier-ignore
  generateBridgeOutNervosTransaction: <T extends NetworkTypes>(payload: GenerateBridgeOutNervosTransactionPayload) => Promise<GenerateTransactionResponse<T>>

  /* send transaction */
  sendSignedTransaction: <T extends NetworkBase>(
    payload: SignedTransactionPayload<T>
  ) => Promise<TransactionIdent>;

  /* get transaction summary */
  // prettier-ignore
  /**
   * get the status of a transaction
   */
  getBridgeTransactionStatus: (payload: GetBridgeTransactionStatusPayload) => Promise<GetBridgeTransactionStatusResponse>;
  // prettier-ignore
  getBridgeTransactionSummaries: (payload: GetBridgeTransactionSummariesPayload) => Promise<TransactionSummaryWithStatus[]>;

  // get an asset list, or if no `name` param is passed in, return a default list of whitelisted assets
  getAssetList: (name?: string) => Promise<RequiredAsset<"info">[]>;
  // get the user's balance, or if no `assets` param is passed in, return all whitelisted assets
  // prettier-ignore
  getBalance: (payload: GetBalancePayload) => Promise<GetBalanceResponse>;

  // prettier-ignore
  getBridgeInNervosBridgeFee: (payload: GetBridgeInNervosBridgeFeePayload) => Promise<GetBridgeInNervosBridgeFeeResponse>
  // prettier-ignore
  getBridgeOutNervosBridgeFee: (payload: GetBridgeOutNervosBridgeFeePayload) => Promise<GetBridgeOutNervosBridgeFeeResponse>

  getBridgeConfig: () => Promise<GetConfigResponse>;
}
