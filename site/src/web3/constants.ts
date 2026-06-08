/** EAS deployments on Sepolia (verify against https://docs.attest.org/ deployments). */
export const EAS_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
export const SCHEMA_REGISTRY_ADDRESS = "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
export const SEPOLIA_CHAIN_ID = 11155111;

/** The comment schema (registered once; demo keeps the body inline). */
export const SCHEMA =
  "string chapter,string blockId,string lang,bytes32 blockHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,bytes32 parentUid,string body";
