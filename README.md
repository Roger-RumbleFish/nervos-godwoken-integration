# Nervos Godwoken Integration

https://www.npmjs.com/package/nervos-godwoken-integration

## Create Layer 2 account using MetaMask

```
import { AddressTranslator } from 'nervos-godwoken-integration';

const addressTranslator = new AddressTranslator();
await addressTranslator.init('testnet');

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

const addressTranslator = new AddressTranslator();
await addressTranslator.init('testnet');

await addressTranslator.connectWallet(ETHEREUM_PRIVATE_KEY);

const ethereumAddress = addressTranslator.getConnectedWalletAddress();

const layer1TxHash = await addressTranslator.createLayer2Address(ethereumAddress);
```

## Withdraw

```
const GODWOKEN_RPC_URL = 'https://godwoken-testnet-web3-v1-rpc.ckbapp.dev';
const godwokenWithdraw = new GodwokenWithdraw(GODWOKEN_RPC_URL, CONFIG, addressTranslator);
await godwokenWithdraw.init('testnet');

await godwokenWithdraw.connectWallet();

await godwokenWithdraw.withdraw(ethAddress, amount);
```

## Send SUDT from Layer 1 to any CKB address

```
import { WalletAssetsSender  } from "nervos-godwoken-integration";

const assetSender = new WalletAssetsSender('https://testnet.ckb.dev/rpc', 'https://testnet.ckb.dev/indexer');
await assetSender.init('testnet');
await assetSender.connectWallet(); // you can also pass private key

const dckbIssuerHash = '0xc43009f083e70ae3fee342d59b8df9eec24d669c1c3a3151706d305f5362c37e';
const ckbBalance = await addressTranslator.getConnectedWalletCKBBalance();
const dckbBalance = await addressTranslator.getConnectedWalletSUDTBalance(dckbIssuerHash);

console.log({
    ckbBalance,
    dckbBalance
});

const txHash = await addressTranslator.sendSUDT('777', 'ckt1q3vvtay34wndv9nckl8hah6fzzcltcqwcrx79apwp2a5lkd07fdx85tnxya9r78ux770vatfk336hkyasxzy7r38glc', dckbIssuerHash);
```