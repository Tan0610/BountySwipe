declare module "@x402/next" {
  export function paymentProxy(routes: any, server: any): any;
}

declare module "@x402/core/server" {
  export class x402ResourceServer {
    register(network: string, scheme: any): this;
  }
}

declare module "@x402/evm/exact/server" {
  export class ExactEvmScheme {
    constructor();
  }
}

declare module "@x402/core/types" {
  export type Network = string;

  export interface PaymentConfig {
    [key: string]: any;
  }
}
