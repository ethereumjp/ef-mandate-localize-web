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
import { SCHEMA_REGISTRY_ADDRESS } from "../src/web3/constants";
import { ANNO_SCHEMA } from "../src/anno/constants";

const pk = process.env.SEPOLIA_PRIVATE_KEY;
const rpc = process.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
if (!pk) throw new Error("set SEPOLIA_PRIVATE_KEY (a funded Sepolia testnet key)");

const signer = new Wallet(pk, new JsonRpcProvider(rpc));
const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
registry.connect(signer);

console.log("registering anno schema on Sepolia…");
console.log(ANNO_SCHEMA);
const tx = await registry.register({
  schema: ANNO_SCHEMA,
  resolverAddress: "0x".padEnd(42, "0"),
  revocable: true,
});
const uid = await tx.wait();
console.log(`\nanno schema UID: ${uid}`);
console.log("→ set PUBLIC_EAS_ANNO_SCHEMA_UID in site/.env to this value");
