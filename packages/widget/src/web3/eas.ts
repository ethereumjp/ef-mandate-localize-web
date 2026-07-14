import type { PublicClient, WalletClient } from "viem";
import { decodeEventLog, parseAbi } from "viem";
import { EMPTY_UID } from "@anno/core/anno/constants";

// The two EAS contract fragments the widget needs (v0.26 attest + its event).
const EAS_ABI = parseAbi([
  "struct AttestationRequestData { address recipient; uint64 expirationTime; bool revocable; bytes32 refUID; bytes data; uint256 value; }",
  "struct AttestationRequest { bytes32 schema; AttestationRequestData data; }",
  "function attest(AttestationRequest request) payable returns (bytes32)",
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);

/** Submit a comment attestation via the EAS contract; resolves to the new attestation UID. */
export async function attestComment(
  wallet: WalletClient,
  publicClient: PublicClient,
  schemaUid: string,
  encodedData: `0x${string}`,
  opts: { recipient: string; refUID?: string; eas: string },
): Promise<string> {
  const account = wallet.account;
  if (!account) throw new Error("wallet has no account");
  const hash = await wallet.writeContract({
    address: opts.eas as `0x${string}`,
    abi: EAS_ABI,
    functionName: "attest",
    args: [
      {
        schema: schemaUid as `0x${string}`,
        data: {
          recipient: opts.recipient as `0x${string}`,
          expirationTime: 0n,
          revocable: true,
          refUID: (opts.refUID ?? EMPTY_UID) as `0x${string}`,
          data: encodedData,
          value: 0n,
        },
      },
    ],
    account,
    chain: wallet.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: EAS_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "Attested") return ev.args.uid;
    } catch {
      // not an Attested log — keep scanning
    }
  }
  throw new Error("attest transaction confirmed but no Attested event found");
}
