import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { SEPOLIA_CHAIN_ID } from "../../web3/config";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const cls =
  "rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        className={cls}
        disabled={isPending}
        onClick={() => connect({ connector: injected() })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
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
      {address ? short(address) : "Connected"}
    </button>
  );
}
