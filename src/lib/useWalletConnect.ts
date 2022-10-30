import BN from "bn.js";
import { Address, Cell } from "ton";
import {
  TonhubConnector,
  TonhubCreatedSession,
  TonhubSessionAwaited,
  TonhubWalletConfig,
} from "ton-x";
const connector = new TonhubConnector({});

let session = JSON.parse(localStorage.getItem("tonhubSession") ?? "null");

export function useWalletConnect() {

  return {
    connect: async (onLinkReady: (link: string) => void) => {
      if (session) return;

      let createdSession: TonhubCreatedSession =
        await connector.createNewSession({
          name: "TON Contract Verifier",
          url: "https://ton.org", // TODO
        });

      // Session ID, Seed and Auth Link
      const sessionId = createdSession.id;
      const sessionSeed = createdSession.seed;
      const sessionLink = createdSession.link;

      onLinkReady(sessionLink);

      const awaitedSession: TonhubSessionAwaited =
        await connector.awaitSessionReady(sessionId, 5 * 60 * 1000); // 5 min timeout

      if (
        awaitedSession.state === "revoked" ||
        awaitedSession.state === "expired"
      ) {
        // Handle revoked or expired awaitedSession
      } else if (awaitedSession.state === "ready") {
        // Handle awaitedSession
        const walletConfig: TonhubWalletConfig = awaitedSession.wallet;

        // You need to persist this values to work with this connection:
        // * sessionId
        // * sessionSeed
        // * walletConfig

        // You can check signed wallet config on backend using TonhubConnector.verifyWalletConfig.
        // walletConfig is cryptographically signed for specific session and other parameters
        // you can safely use it as authentication proof without the need to sign something.
        const correctConfig: boolean = TonhubConnector.verifyWalletConfig(
          sessionId,
          walletConfig
        );

        if (correctConfig) {
          const toPersit = { ...createdSession, walletConfig };
          localStorage.setItem("tonhubSession", JSON.stringify(toPersit));
          session = toPersit;
        }

        // ...
      } else {
        throw new Error("Impossible");
      }
    },
    // TODO add txn monitoring
    requestTXN: async (to: string, value: BN, message: Cell) => {
      if (!session) return;

      await connector.requestTransaction({
        seed: session.seed,
        appPublicKey: session.walletConfig.appPublicKey,
        to: to,
        value: value.toString(),
        payload: message.toBoc().toString("base64"),
        timeout: 5 * 60 * 1000,
      });
    },
    walletAddress: session?.walletConfig.address,
  };
}