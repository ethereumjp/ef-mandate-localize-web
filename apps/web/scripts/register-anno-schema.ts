import { JsonRpcProvider, Wallet } from "ethers";
// Named ESM import of @ethereum-attestation-service/eas-sdk fails on Node 24
// because the SDK's ESM build re-exports lodash named exports that Node 24's
// strict ESM does not allow from a CJS module.  Loading via default import
// (CJS interop) is the minimal fix; types are preserved via the type import.
import type { SchemaRegistry as SchemaRegistryType } from "@ethereum-attestation-service/eas-sdk";
import easSdk from "@ethereum-attestation-service/eas-sdk";
const { SchemaRegistry } = easSdk as unknown as {
  SchemaRegistry: typeof SchemaRegistryType;
};
import { resolveNetwork } from "@anno/core/chain";
import { ANNO_SCHEMA } from "@anno/core/anno/constants";

// NETWORK=mainnet|sepolia (default mainnet). The same schema string yields the
// same UID on every chain, but must be registered once per chain.
const network = resolveNetwork(process.env.NETWORK);
const pk = process.env.EAS_PRIVATE_KEY;
if (!pk) throw new Error(`set EAS_PRIVATE_KEY (a funded ${network.label} key)`);
const rpc =
  process.env.EAS_RPC_URL ??
  (network.name === "sepolia"
    ? "https://ethereum-sepolia-rpc.publicnode.com"
    : "https://ethereum-rpc.publicnode.com");

const signer = new Wallet(pk, new JsonRpcProvider(rpc));
const registry = new SchemaRegistry(network.schemaRegistry);
registry.connect(signer);

console.log(`registering anno schema on ${network.label}…`);
console.log(ANNO_SCHEMA);
const tx = await registry.register({
  schema: ANNO_SCHEMA,
  resolverAddress: "0x".padEnd(42, "0"),
  revocable: true,
});
const uid = await tx.wait();
console.log(`\nanno schema UID: ${uid}`);
console.log("→ set PUBLIC_EAS_ANNO_SCHEMA_UID in apps/web/.env to this value");
