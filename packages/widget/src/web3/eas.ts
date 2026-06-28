import { EAS } from "@ethereum-attestation-service/eas-sdk";
import type { TransactionSigner } from "@ethereum-attestation-service/eas-sdk";
import { EAS_ADDRESS } from "@anno/core/chain";
import { EMPTY_UID } from "@anno/core/anno/constants";

/** Submit a comment attestation; resolves to the new attestation UID. */
export async function attestComment(
  signer: TransactionSigner,
  schemaUid: string,
  encodedData: string,
  opts: { recipient: string; refUID?: string },
): Promise<string> {
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);
  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: opts.recipient,
      expirationTime: 0n,
      revocable: true,
      refUID: opts.refUID ?? EMPTY_UID,
      data: encodedData,
    },
  });
  return await tx.wait();
}
