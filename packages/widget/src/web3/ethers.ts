import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import type { Account, Chain, Client, Transport } from "viem";
import { BrowserProvider, JsonRpcSigner } from "ethers";

function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

/** ethers v6 signer for the current wagmi connection (or undefined). */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient({ chainId });
  return useMemo(
    () => (client ? clientToSigner(client as Client<Transport, Chain, Account>) : undefined),
    [client],
  );
}
