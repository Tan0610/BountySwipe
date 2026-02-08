import { paymentProxy } from "@x402/next";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";

const MONAD_NETWORK: Network = "eip155:10143";
const PAY_TO = (process.env.PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

const server = new x402ResourceServer()
  .register(MONAD_NETWORK, new ExactEvmScheme());

const routes = {
  "/api/premium/analyze-content": {
    accepts: [{
      scheme: "exact" as const,
      payTo: PAY_TO,
      price: "$0.001",
      network: MONAD_NETWORK,
    }],
    description: "AI Content Analysis for BountySwipe",
    mimeType: "application/json",
  },
};

export const middleware = paymentProxy(routes, server);
export const config = {
  matcher: ["/api/premium/:path*"],
};
