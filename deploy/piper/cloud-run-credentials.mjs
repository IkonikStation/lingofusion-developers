import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [directory, projectNumber, projectId] = process.argv.slice(2);
const secretFile = join(directory, "gateway-secrets.json");
let secrets;
try {
  secrets = JSON.parse(readFileSync(secretFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = publicKey.export({ format: "jwk" });
  const kid = randomBytes(16).toString("hex");
  secrets = {
    PIPER_API_TOKEN: randomBytes(32).toString("hex"),
    PIPER_WIF_PROVIDER: `projects/${projectNumber}/locations/global/workloadIdentityPools/lingofusion-piper/providers/gateway`,
    PIPER_INVOKER_SERVICE_ACCOUNT: `piper-gateway@${projectId}.iam.gserviceaccount.com`,
    PIPER_WIF_SIGNER: JSON.stringify({ kid, privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") }),
  };
  writeFileSync(join(directory, "gateway-jwks.json"), JSON.stringify({ keys: [{ ...key, kid, alg: "RS256", use: "sig" }] }), { mode: 0o600 });
  writeFileSync(secretFile, JSON.stringify(secrets), { mode: 0o600, flag: "wx" });
}
if (!secrets.PIPER_WIF_PROVIDER.startsWith(`projects/${projectNumber}/`) ||
    secrets.PIPER_INVOKER_SERVICE_ACCOUNT !== `piper-gateway@${projectId}.iam.gserviceaccount.com`) {
  throw new Error("Deployment credentials belong to a different Google Cloud project.");
}
process.stdout.write(createHash("sha256").update(secrets.PIPER_API_TOKEN, "ascii").digest("hex"));
