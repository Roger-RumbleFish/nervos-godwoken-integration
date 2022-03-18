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
const godwokenWithdraw = new GodwokenWithdraw(GODWOKEN_RPC_URL, CONFIG, addressTranslator);
await godwokenWithdraw.init('testnet');

await godwokenWithdraw.connectWallet();

await godwokenWithdraw.withdraw(ethAddress, amount, config.godwoken.rpcUrl);
```

## Unlock

```
const godwokenWithdraw = new GodwokenWithdraw(GODWOKEN_RPC_URL, CONFIG, addressTranslator);
await godwokenWithdraw.init('testnet');

const withdrawRequests = await godwokenWithdraw.fetchWithdrawalRequests(ethAddress);

await godwokenWithdraw.connectWallet();

const txId = await godwokenWithdraw.unlock(withdrawRequests[0], ethAddress);

toast.success(`Transaction submitted: ${txId} (Layer 1 transaction)`);
```