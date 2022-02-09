# Nervos Godwoken Integration

https://www.npmjs.com/package/nervos-godwoken-integration

## Compatibility

Versions `>= 0.2` of this library use Omnilock for Layer 1 account security. If you're looking for Portal Wallet compatible versions check `0.1.x`.

## Create Layer 2 account using MetaMask

```
import { AddressTranslator } from 'nervos-godwoken-integration';

const addressTranslator = new AddressTranslator();
await addressTranslator.init('testnet');

await translator.connectWallet();

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