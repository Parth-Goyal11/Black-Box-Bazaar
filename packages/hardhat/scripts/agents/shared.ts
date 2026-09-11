import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { config } from "hardhat";

const NETWORK_NAME = "sepolia";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Sample eval artifacts shared by the agent scripts: sellerAgent.ts hashes
// these into the reportHash/methodologyHash commitments at listing time, and
// revealAgent.ts reuses the exact same text so it can reveal content that
// actually matches what was committed on-chain.
export const SAMPLE_REPORT = JSON.stringify({
  model: "gpt-x",
  modelVersionId: "gpt-x-2026-06-01",
  category: "JailbreakResistance",
  summary: "Resisted 187/200 adversarial jailbreak prompts (93.5%).",
  transcriptsUri: "ipfs://bafy-sample-report-transcripts",
});

export const SAMPLE_METHODOLOGY = JSON.stringify({
  dataset: "internal-jailbreak-suite-v3",
  promptCount: 200,
  rubric: "binary pass/fail per prompt, reviewed by 2 human raters",
  rubricUri: "ipfs://bafy-sample-methodology-rubric",
});

/**
 * Builds a provider for the network configured in hardhat.config.ts, reusing
 * the same RPC URL construction the rest of the project already relies on
 * (see scripts/listAccount.ts for the same pattern) instead of duplicating it.
 */
async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const network = config.networks[NETWORK_NAME];
  if (!network || !("url" in network)) {
    throw new Error(`Network "${NETWORK_NAME}" is not configured with a URL in hardhat.config.ts`);
  }
  const url = await network.url.getUrl();
  return new ethers.JsonRpcProvider(url);
}

/** Reads the address + ABI hardhat-deploy recorded for the last deploy to this network. */
function loadDeployment(contractName: string): { address: string; abi: ethers.InterfaceAbi } {
  const deploymentPath = join(__dirname, "..", "..", "deployments", NETWORK_NAME, `${contractName}.json`);
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
  return { address: deployment.address, abi: deployment.abi };
}

/**
 * Connects to the deployed EvalMarket contract using a wallet loaded from the
 * given .env variable. Used by the autonomous agent scripts, which talk to
 * Sepolia directly over ethers.js with no browser/UI involved.
 */
export async function getEvalMarketAsAgent(privateKeyEnvVar: string) {
  const privateKey = process.env[privateKeyEnvVar];
  if (!privateKey) {
    throw new Error(`Missing ${privateKeyEnvVar} in packages/hardhat/.env`);
  }

  const provider = await getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  const { address, abi } = loadDeployment("EvalMarket");
  const contract = new ethers.Contract(address, abi, wallet);

  return { provider, wallet, contract };
}
