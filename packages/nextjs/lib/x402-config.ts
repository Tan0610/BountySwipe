export const MONAD_NETWORK = "eip155:10143" as const;
export const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const FACILITATOR_URL = "https://x402-facilitator.molandak.org";
export const ANALYSIS_PRICE = "$0.001";

export const MONAD_CHAIN_CONFIG = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
};
