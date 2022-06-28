# Nervos Godwoken Integration

https://www.npmjs.com/package/nervos-godwoken-integration

## Create Layer 2 account using MetaMask

```
import { AddressTranslator } from 'nervos-godwoken-integration';

const addressTranslator = new AddressTranslator('testnet');
await addressTranslator.init();

await addressTranslator.connectWallet();

const ethereumAddress = addressTranslator.getConnectedWalletAddress();

const layer1TxHash = await addressTranslator.createLayer2Address(ethereumAddress);
```

You can put resulting `layer1TxHash` in https://explorer.nervos.org/aggron/ to view the transaction status.

Above function will create Layer 2 account on Godwoken Testnet secured by Omnilock. Note: You need minimum 462 CKB on your Layer 1 Omnilock ETH account.

## Create Layer 2 account using Ethereum private key

```
import { AddressTranslator } from 'nervos-godwoken-integration';

const ETHEREUM_PRIVATE_KEY = '0x...';

const addressTranslator = new AddressTranslator('testnet');
await addressTranslator.init();

await addressTranslator.connectWallet(ETHEREUM_PRIVATE_KEY);

const ethereumAddress = addressTranslator.getConnectedWalletAddress();

const layer1TxHash = await addressTranslator.createLayer2Address(ethereumAddress);
```

## Deposit tokens (SUDT) to Layer 2 account

Notice that in sendSUDT additional CKB needs to be sent so resulting transaction output contains at least 400 CKB.

```
import { AddressTranslator, WalletAssetsSender  } from "nervos-godwoken-integration";

const PRIVATE_KEY = '0xd9066ff9f753a1898709b568119055660a77d9aae4d7a4ad677b8fb3d2a571e5';
const DCKB_ISSUER_HASH = '0xc43009f083e70ae3fee342d59b8df9eec24d669c1c3a3151706d305f5362c37e';

const translator = new AddressTranslator('testnet');
await translator.init();

const assetSender = new WalletAssetsSender('https://testnet.ckb.dev/rpc', 'https://testnet.ckb.dev/indexer');
await assetSender.initWalletProvider('testnet');

await assetSender.connectWallet(PRIVATE_KEY);
const ethAddress = assetSender.getConnectedWalletAddress();

if (!ethAddress) {
    throw new Error(`Wallet not connected.`);
}

const txHash = await assetSender.sendSUDT(
    '100000000', // 1 dCKB
    await translator.getLayer2DepositAddress(ethAddress),
    DCKB_ISSUER_HASH,
    (85 * 10**8).toString() // additional CKB capacity is required so resulting transaction output contains at least 400 CKB
);
```

## Withdraw CKB from Layer 2 to Layer 1

```
const GODWOKEN_RPC_URL = 'https://godwoken-testnet-v1.ckbapp.dev';
const godwokenWithdraw = new GodwokenWithdraw(GODWOKEN_RPC_URL, CONFIG, addressTranslator);
await godwokenWithdraw.initWalletProvider('testnet');

await godwokenWithdraw.connectWallet();

await godwokenWithdraw.withdraw(ethAddress, amount);
```

## Send SUDT from Layer 1 to any CKB address

```
import { WalletAssetsSender  } from "nervos-godwoken-integration";

const assetSender = new WalletAssetsSender('https://testnet.ckb.dev/rpc', 'https://testnet.ckb.dev/indexer');
await assetSender.initWalletProvider('testnet');
await assetSender.connectWallet(); // you can also pass private key

const dckbIssuerHash = '0xc43009f083e70ae3fee342d59b8df9eec24d669c1c3a3151706d305f5362c37e';
const ckbBalance = await assetSender.getConnectedWalletCKBBalance();
const dckbBalance = await assetSender.getConnectedWalletSUDTBalance(dckbIssuerHash);

console.log({
    ckbBalance,
    dckbBalance
});

const txHash = await assetSender.sendSUDT('777', 'ckt1q3vvtay34wndv9nckl8hah6fzzcltcqwcrx79apwp2a5lkd07fdx85tnxya9r78ux770vatfk336hkyasxzy7r38glc', dckbIssuerHash);
```
