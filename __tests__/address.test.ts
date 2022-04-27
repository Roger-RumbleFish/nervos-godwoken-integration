import { AddressTranslator } from '../src/address';

describe('AddressTranslator', () => {
    it('getLayer2DepositAddress() throws friendly error when init() has not been called', async () => {
        const translator = new AddressTranslator();

        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';

        try {
            await translator.getLayer2DepositAddress(ethAddress)
            expect(false).toBe(true)
        } catch (error) {
            const errorMessage = (error as unknown as { message: string }).message
            expect(errorMessage).toBe('PWCore.config is empty. Did you call <AddressTranslator>.init() function?');
        }
    });
    test('ethAddressToCkbAddress() correctly transforms ethereum address to portal wallet address (CKB2021 address format) locked by ethereum key on Nervos Layer 1 testnet', async () => {
        const translator = new AddressTranslator();
        
        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';

        await translator.init({ pwChainId: 1 });
    
        const portalWalletLayer1CkbAddress = translator.ethAddressToCkbAddress(ethAddress);
    
        expect(portalWalletLayer1CkbAddress).toBe('ckt1qpvvtay34wndv9nckl8hah6fzzcltcqwcrx79apwp2a5lkd07fdxxqw3wvcn550clsmmean4dx6x827cnkqcgncz88uxh');
    });

    test('getLayer2DepositAddress() correctly calculates Layer 2 deposit address (CKB2021 address format) secured by Portal Wallet lock on Layer 1', async () => {
        const translator = new AddressTranslator();

        const ethAddress = '0xD173313A51f8fc37BcF67569b463abd89d81844f';
    
        await translator.init({ pwChainId: 1 });

        const portalWalletLayer2DepositAddress = await translator.getLayer2DepositAddress(ethAddress);
    
        expect(portalWalletLayer2DepositAddress.addressString)
            .toBe('ckt1qpdz2p4mdrvp5ywu4kk5edl2uc4p03puvx07g7kgqdau3n3dmypkqq2vctn9ycsy4e4zar70ztm663e0gxskqm2mjcjta67jzhtcpqyld2ssqqqqzqqqqqpsqqqqpxgqqqqx97yt4hykncxxht83shapc3g2uxtf4awek7przlu7ekdjlkdvjcrfqqqqqyqqqqqrqqqqqqcsqqqqmmkp8facuyq9092p8pxv4a94ygmn8e99fq7r4my4mhzvr402tv3qzdqqqqqyeshx2f3qftn2968u7yhh44rj7sdpvpk4h93yhm4ay9whszqf76k3wvcn550clsmmean4dx6x827cnkqcgncq5vpqqqqqqrqqlmvzug');
    });
});
