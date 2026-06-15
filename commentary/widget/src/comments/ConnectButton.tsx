import {
  useAccount,
  useConnect,
  useDisconnect,
  useEnsName,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";
import { SEPOLIA_CHAIN_ID } from "../web3/config";

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Outline cobalt, square. Action states (connect/switch) are uppercased; the
// connected state shows an address/ENS name, which must NOT be uppercased.
const base =
  "h-8 max-w-[12rem] cursor-pointer truncate border border-cobalt px-2 py-1 font-mono text-xs text-cobalt hover:bg-surface disabled:cursor-not-allowed";
const action = `${base} uppercase tracking-wider`;

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
        className={action}
        disabled={isPending}
        onClick={() => connect({ connector: injected() })}
      >
        {isPending ? "Connecting…" : "Connect"}
      </button>
    );
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <button
        className={action}
        onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
      >
        Switch to Sepolia
      </button>
    );
  }
  return (
    <button className={base} title="Disconnect" onClick={() => disconnect()}>
      {ensName ?? (address ? short(address) : "Connected")}
    </button>
  );
}
