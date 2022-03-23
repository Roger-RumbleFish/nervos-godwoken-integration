import { BigNumber } from "@ethersproject/bignumber";
import { AddressTranslator } from "../src/address";
import { BridgeRPCHandler } from "../src/bridge/force-bridge-handler";

describe("BridgeRPCHandler", () => {
  test("generateBridgeInNervosTransaction() works", async () => {
    const bridge = new BridgeRPCHandler(
      "https://testnet.forcebridge.com/api/force-bridge/api/v1"
    );
    const ethAddress = "0x018332E7b64E01246BfC981C75f8f5A5B18115F0";

    const translator = new AddressTranslator();
    await translator.init("testnet");

    const recipient = translator.ethAddressToCkbAddress(ethAddress);
    const sender = translator.ethAddressToCkbAddress(ethAddress);

    const tx = await bridge.generateBridgeInNervosTransaction({
        asset: {
          amount: "100000000000000000",
          ident: "0x0000000000000000000000000000000000000000",
          network: "Ethereum",
        },
        recipient,
        sender,
      });


    type RawTransaction = {
        data: string;
        to: string;
        value: BigNumber
    }

    expect(
      tx.network
    ).toBe("Ethereum");
    expect((tx.rawTransaction as RawTransaction).data).toBe('0xa406ad9a000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000062636b74317133756c6a7a6134617a66647372776a7a6470656136343432796671616471687637797a6675357a6b6e6c6d7475736d34356870757167707376657730646a7771796a78686c79637233366c336164396b787133747571716c6d6d636a6a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
    expect((tx.rawTransaction as RawTransaction).to).toBe('0x0670009F6126e57C679E90aEE46861D28DA2F703');
    expect((tx.rawTransaction as RawTransaction).value.toString()).toBe('100000000000000000');
  });
});
