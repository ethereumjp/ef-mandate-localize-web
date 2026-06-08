import { EAS } from "@ethereum-attestation-service/eas-sdk";
import type { TransactionSigner } from "@ethereum-attestation-service/eas-sdk";
import { EAS_ADDRESS } from "./constants";

const ZERO_ADDR = "0x".padEnd(42, "0");

/** Submit a comment attestation; resolves to the new attestation UID. */
export async function attestComment(
  signer: TransactionSigner,
  schemaUid: string,
  encodedData: string,
): Promise<string> {
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);
  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: ZERO_ADDR,
      expirationTime: 0n,
      revocable: true,
      data: encodedData,
    },
  });
  return await tx.wait();
}
