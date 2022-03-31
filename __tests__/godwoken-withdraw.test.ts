import { AddressTranslator } from '../src/address';
import { GodwokenWithdraw, GodwokenWithdrawConfig } from '../src/bridge/godwoken-withdraw';

describe('GodwokenWithdraw', () => {
    test('canWithdrawAmount() works', async () => {
        const translator = new AddressTranslator();
        await translator.init('testnet');

        const GODWOKEN_RPC_URL = 'https://godwoken-testnet-web3-v1-rpc.ckbapp.dev';
        const CONFIG: GodwokenWithdrawConfig = {
            creatorAccountId: '0x6',
            ethAccountLockScriptTypeHash: '',
            polyjuiceValidatorScriptCodeHash: '',
            rollupTypeHash: '',
            rollupTypeScript: {
                code_hash: '',
                hash_type: 'type',
                args: ''
            },
            withdrawalLockScript: {
                code_hash: '',
                hash_type: 'type',
                args: ''
            }
        };

        const withdraw = new GodwokenWithdraw(GODWOKEN_RPC_URL, CONFIG, translator);
        await withdraw.init('testnet');

        expect(withdraw.canWithdrawAmount('0').canWithdraw).toBe(false);
        expect(withdraw.canWithdrawAmount('1').canWithdraw).toBe(false);
        expect(withdraw.canWithdrawAmount('200').canWithdraw).toBe(false);
        expect(withdraw.canWithdrawAmount('250').canWithdraw).toBe(false);
        expect(withdraw.canWithdrawAmount('300').canWithdraw).toBe(true);
        expect(withdraw.canWithdrawAmount('999999999999900').canWithdraw).toBe(true);
        expect(withdraw.canWithdrawAmount('0').minimum).toBe("25400000000");
    });
});
