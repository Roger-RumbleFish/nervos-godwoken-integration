import { AddressTranslator } from '../src/address';

describe('AddressTranslator', () => {
    test('ethAddressToCkbAddress() correctly transforms ethereum address to portal wallet address locked by ethereum key on Nervos Layer 1 testnet', async () => {
        const translator = new AddressTranslator();
        await translator.init('testnet');
        
        const ethAddress = '0x018332E7b64E01246BfC981C75f8f5A5B18115F0';
    
        const portalWalletLayer1CkbAddress = translator.ethAddressToCkbAddress(ethAddress);
    
        expect(portalWalletLayer1CkbAddress).toBe('ckt1q3uljza4azfdsrwjzdpea6442yfqadqhv7yzfu5zknlmtusm45hpuqgpsvew0djwqyjxhlycr36l3ad9kxq3tuqqlmmcjj');
    });

    test('getLayer2DepositAddress() throws friendly error when init() has not been called', async () => {
        const translator = new AddressTranslator();

        const ethAddress = '0x018332E7b64E01246BfC981C75f8f5A5B18115F0';

        try {
            await translator.getLayer2DepositAddress(ethAddress)
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.message).toBe('<AddressTranslator>._provider.config is empty. Did you call <AddressTranslator>.init() function?');
        }
    });

    test('getLayer2DepositAddress() correctly calculates Layer 2 deposit address secured by Omni Lock on Layer 1', async () => {
        const translator = new AddressTranslator();
        await translator.init('testnet');

        const ethAddress = '0x018332E7b64E01246BfC981C75f8f5A5B18115F0';

        const omniLockLayer2DepositAddress = await translator.getLayer2DepositAddress(ethAddress);
    
        expect(omniLockLayer2DepositAddress).toBe('ckt1q3dz2p4mdrvp5ywu4kk5edl2uc4p03puvx07g7kgqdau3n3dmypkqnxzuefxyp9wdghglncj77k5wt6p59sx6kukyjlwh5s467qgp8m25yqqqqqsqqqqqvqqqqqfjqqqqqaytpzxduzxash5rhr4wvf02nxxc55rnx9cpgske3mvvxms9kduj6gqqqqpqqqqqqcqqqqqxyqqqqx7asf60w8pqpte2sfcfn90fdfzxue7ff2g8sawe9wacnqat6jmygqngqqqqpxv9ejjvgz2u63w3l839aadguh5rgtqd4devf97a0fpt4uqsz0k5qvrxtnmvnspy34lexquwhu0tfd3sy2lqq9rqgqqqqqqcqzkhwvr');
    });
});
