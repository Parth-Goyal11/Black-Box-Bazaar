import { ethers } from "ethers";
import { SAMPLE_METHODOLOGY, SAMPLE_REPORT, getEvalMarketAsAgent } from "./shared.js";

/**
 * Autonomous seller agent. Connects directly to the deployed EvalMarket
 * contract on Sepolia with ethers.js (no browser/UI) and creates a listing
 * for a model evaluation report it has already produced off-chain.
 *
 * Run with: npx tsx scripts/agents/sellerAgent.ts
 */

// Mirrors the Solidity `EvalCategory` enum in contracts/Marketplace.sol —
// enum values cross the ABI boundary as plain integers.
enum EvalCategory {
  JailbreakResistance = 0,
  ToolUseAccuracy = 1,
  HallucinationRate = 2,
  PromptInjectionSusceptibility = 3,
  Other = 4,
}

async function main() {
  const { wallet, contract } = await getEvalMarketAsAgent("SELLER_AGENT_PRIVATE_KEY");
  console.log(`🧪 Seller agent starting as ${wallet.address}`);

  const modelName = "gpt-x";
  const modelVersionId = "gpt-x-2026-06-01"; // pinned checkpoint the eval was actually run against
  const evalCategory = EvalCategory.JailbreakResistance;
  const price = ethers.parseEther("0.01");
  const reportHash = ethers.keccak256(ethers.toUtf8Bytes(SAMPLE_REPORT));
  const methodologyHash = ethers.keccak256(ethers.toUtf8Bytes(SAMPLE_METHODOLOGY));
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 6 * 60 * 60); // valid for 6 hours

  const bond: bigint = await contract.MIN_BOND();

  console.log("📤 Decision: create a listing with the following terms:");
  console.log(`   modelName:       ${modelName}`);
  console.log(`   modelVersionId:  ${modelVersionId}`);
  console.log(`   evalCategory:    ${EvalCategory[evalCategory]} (${evalCategory})`);
  console.log(`   price:           ${ethers.formatEther(price)} ETH`);
  console.log(`   reportHash:      ${reportHash}`);
  console.log(`   methodologyHash: ${methodologyHash}`);
  console.log(`   validUntil:      ${new Date(Number(validUntil) * 1000).toISOString()}`);
  console.log(`   bond staked:     ${ethers.formatEther(bond)} ETH (MIN_BOND)`);

  const tx = await contract.createListing(
    modelName,
    modelVersionId,
    evalCategory,
    price,
    reportHash,
    methodologyHash,
    validUntil,
    { value: bond },
  );
  console.log(`⛓️  createListing() tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  const listingCreatedEvent = receipt.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: ethers.LogDescription | null) => event?.name === "ListingCreated");

  if (!listingCreatedEvent) {
    throw new Error("createListing() succeeded but no ListingCreated event was found in the receipt");
  }

  console.log(`✅ Listing created. listingId = ${listingCreatedEvent.args.listingId}`);
}

main().catch(error => {
  console.error("❌ Seller agent failed:", error);
  process.exitCode = 1;
});
