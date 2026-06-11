import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";
import { SEPOLIA_CHAIN_ID } from "../../web3/config";

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const cls =
  "rounded h-8 max-w-[12rem] truncate border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  // ENS reverse records live on mainnet, so resolve there regardless of the
  // connected chain; fall back to the shortened address when there's no name.
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  if (!isConnected) {
    return (
      <button
        className={cls}
        disabled={isPending}
        onClick={() => connect({ connector: injected() })}
      >
        {isPending ? "Connecting…" : "Connect"}
      </button>
    );
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <button className={cls} onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
        Switch to Sepolia
      </button>
    );
  }
  return (
    <button className={cls} title="Disconnect" onClick={() => disconnect()}>
      {ensName ?? (address ? short(address) : "Connected")}
    </button>
  );
}
