# Nervos Godwoken Integration

https://www.npmjs.com/package/nervos-godwoken-integration

## Compatibility

Versions `>= 0.2` of this library use Omnilock for Layer 1 account security. If you're looking for Portal Wallet compatible versions check `0.1.x`.

## Code examples

### Create Layer 2 account using Ethereum private key

```
import { AddressTranslator } from 'nervos-godwoken-integration';

const ETHEREUM_ADDRESS = '0x...';
const ETHEREUM_PRIVATE_KEY = '0x...';

const addressTranslator = new AddressTranslator(undefined, ETHEREUM_PRIVATE_KEY);
await addressTranslator.init('testnet');

const layer1TxHash = await addressTranslator.createLayer2Address(ETHEREUM_ADDRESS);
```

You can put resulting `layer1TxHash` in https://explorer.nervos.org/aggron/ to view the transaction status.

Above function will create Layer 2 account on Godwoken Testnet secured by Omnilock. Note: You need minimum 462 CKB on your Layer 1 Omnilock ETH account.