import { Interface, JsonRpcProvider, Wallet } from "ethers";
// Named ESM import of @ethereum-attestation-service/eas-sdk fails on Node 24
// because the SDK's ESM build re-exports lodash named exports that Node 24's
// strict ESM does not allow from a CJS module.  Loading via default import
// (CJS interop) is the minimal fix; types are preserved via the type import.
import type { SchemaRegistry as SchemaRegistryType } from "@ethereum-attestation-service/eas-sdk";
import easSdk from "@ethereum-attestation-service/eas-sdk";
const { SchemaRegistry } = easSdk as unknown as {
  SchemaRegistry: typeof SchemaRegistryType;
};
import { resolveNetworkStrict } from "@anno/core/chain";
import {
  ANNO_SCHEMA,
  ANNO_SCHEMA_UID,
  ANNO_RESOLVER,
  ANNO_REVOCABLE,
} from "@anno/core/anno/constants";

// NETWORK=mainnet|sepolia (default mainnet). The schema UID is deterministic —
// keccak256(schema, resolver, revocable) — the same on every chain and
// independent of who registers; register the same schema once per chain to make
// it usable there.
const network = resolveNetworkStrict(process.env.NETWORK);

if (process.env.MODE === "calldata") {
  // Safe / multisig path: print the deterministic UID and the register() call to
  // submit from the Safe (e.g. the Safe{Wallet} Transaction Builder). Since EAS
  // schema registration is caller-independent, the UID is identical to the EOA
  // path. No key, no RPC — fully offline.
  const data = new Interface([
    "function register(string schema, address resolver, bool revocable) returns (bytes32)",
  ]).encodeFunctionData("register", [ANNO_SCHEMA, ANNO_RESOLVER, ANNO_REVOCABLE]);
  console.log(`# Register the anno schema on ${network.label} via a Safe multisig.`);
  console.log("# Submit this call from the Safe (e.g. the Transaction Builder):\n");
  console.log(`to        ${network.schemaRegistry}   # EAS SchemaRegistry`);
  console.log("value     0");
  console.log("function  register(string schema, address resolver, bool revocable)");
  console.log(`  schema    ${ANNO_SCHEMA}`);
  console.log(`  resolver  ${ANNO_RESOLVER}`);
  console.log(`  revocable ${ANNO_REVOCABLE}`);
  console.log(`\ndata      ${data}`);
  console.log(`\nschema UID (deterministic — same on every chain):\n${ANNO_SCHEMA_UID}`);
  console.log("(the widget ships this UID as its built-in default — no env var needed)");
} else {
  // Default: register directly from a funded EOA key.
  const pk = process.env.EAS_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      `set EAS_PRIVATE_KEY (a funded ${network.label} key), or use MODE=calldata to register via a Safe`,
    );
  }
  const rpc = process.env.EAS_RPC_URL ?? network.rpc;

  const signer = new Wallet(pk, new JsonRpcProvider(rpc));
  const registry = new SchemaRegistry(network.schemaRegistry);
  registry.connect(signer);

  console.log(`registering anno schema on ${network.label}…`);
  console.log(ANNO_SCHEMA);
  const tx = await registry.register({
    schema: ANNO_SCHEMA,
    resolverAddress: ANNO_RESOLVER,
    revocable: ANNO_REVOCABLE,
  });
  const registered = await tx.wait();
  console.log(`\nanno schema UID: ${registered}`);
  if (registered.toLowerCase() !== ANNO_SCHEMA_UID.toLowerCase()) {
    console.log(`(note: expected deterministic UID ${ANNO_SCHEMA_UID})`);
  }
  console.log("(the widget ships this UID as its built-in default — no env var needed)");
}
