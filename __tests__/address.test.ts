import { AddressTranslator } from '../src/address';

describe('AddressTranslator', () => {
    test('ethAddressToCkbAddress() correctly transforms ethereum address to portal wallet address locked by ethereum key on Nervos Layer 1 testnet', () => {
        const translator = new AddressTranslator();
        
        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';
    
        const portalWalletLayer1CkbAddress = translator.ethAddressToCkbAddress(ethAddress);
    
        expect(portalWalletLayer1CkbAddress).toBe('ckt1q3vvtay34wndv9nckl8hah6fzzcltcqwcrx79apwp2a5lkd07fdx85tnxya9r78ux770vatfk336hkyasxzy7r38glc');
    });

    test('getLayer2DepositAddress() throws friendly error when init() has not been called', async () => {
        const translator = new AddressTranslator();

        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';

        try {
            await translator.getLayer2DepositAddress(ethAddress)
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.message).toBe('PWCore.config is empty. Did you call <AddressTranslator>.init() function?');
        }
    });

    test('getLayer2DepositAddress() correctly calculates Layer 2 deposit address secured by Portal Wallet lock on Layer 1', async () => {
        const translator = new AddressTranslator();

        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';
    
        await translator.init();

        const portalWalletLayer2DepositAddress = await translator.getLayer2DepositAddress(ethAddress);
    
        expect(portalWalletLayer2DepositAddress.addressString).toBe('ckt1q3dz2p4mdrvp5ywu4kk5edl2uc4p03puvx07g7kgqdau3n3dmypkqnxzuefxyp9wdghglncj77k5wt6p59sx6kukyjlwh5s467qgp8m25yqqqqqsqqqqqvqqqqqfjqqqqp303zade957p346euv9lgwy2zhpj6d0tkdhsgchl8kdnvhantykq6gqqqqpqqqqqqcqqqqqxyqqqqx7asf60w8pqpte2sfcfn90fdfzxue7ff2g8sawe9wacnqat6jmygqngqqqqpxv9ejjvgz2u63w3l839aadguh5rgtqd4devf97a0fpt4uqsz0k45tnxya9r78ux770vatfk336hkyasxzy7q9rqgqqqqqqcqwe3kzy');
    });
});
