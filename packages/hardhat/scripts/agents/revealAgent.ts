import { ethers } from "ethers";
import { SAMPLE_METHODOLOGY, SAMPLE_REPORT, getEvalMarketAsAgent } from "./shared.js";

/**
 * Autonomous reveal agent. Acts as the seller: connects directly to the
 * deployed EvalMarket contract on Sepolia with ethers.js (no browser/UI) and
 * reveals the report for the most recent purchase awaiting reveal.
 *
 * Run with: npx tsx scripts/agents/revealAgent.ts
 */

const PAID_STATE = 0n; // PurchaseState.Paid

async function main() {
  const { wallet, contract } = await getEvalMarketAsAgent("SELLER_AGENT_PRIVATE_KEY");
  console.log(`📣 Reveal agent starting as ${wallet.address}`);

  const purchasesCount: bigint = await contract.purchasesCount();
  console.log(`🔍 Scanning ${purchasesCount} purchase(s), most recent first, for one awaiting reveal...`);

  let purchaseId: bigint | null = null;
  let listing: Awaited<ReturnType<typeof contract.listings>> | null = null;

  for (let i = purchasesCount - 1n; i >= 0n; i--) {
    const purchase = await contract.purchases(i);

    if (purchase.state !== PAID_STATE) {
      console.log(`   ⏭️  Purchase #${i}: state=${purchase.state}, not awaiting reveal.`);
      continue;
    }

    const candidateListing = await contract.listings(purchase.listingId);
    if (candidateListing.seller.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log(
        `   ⏭️  Purchase #${i}: awaiting reveal, but listing #${purchase.listingId}'s seller ` +
          `(${candidateListing.seller}) is not this wallet.`,
      );
      continue;
    }

    purchaseId = i;
    listing = candidateListing;
    break;
  }

  if (purchaseId === null || listing === null) {
    console.log("✅ Nothing to reveal — no purchase in the Paid state for a listing this wallet sold.");
    return;
  }

  console.log(
    `📤 Found purchase #${purchaseId} awaiting reveal for "${listing.modelName}" @ ${listing.modelVersionId}.`,
  );

  const reportHash = ethers.keccak256(ethers.toUtf8Bytes(SAMPLE_REPORT));
  const methodologyHash = ethers.keccak256(ethers.toUtf8Bytes(SAMPLE_METHODOLOGY));
  if (reportHash === listing.reportHash && methodologyHash === listing.methodologyHash) {
    console.log("   🔒 Verified: keccak256(sample report/methodology) matches the listing's committed hashes.");
  } else {
    console.warn(
      "   ⚠️  Sample report/methodology hash does NOT match the listing's committed hashes — " +
        "revealing anyway, but a buyer's off-chain verification would flag this as a mismatch.",
    );
  }

  const reportURI = "local://sample-report-v1";
  const methodologyURI = "local://sample-methodology-v1";

  const tx = await contract.reveal(purchaseId, reportURI, methodologyURI);
  console.log(`⛓️  reveal() tx sent: ${tx.hash}`);
  await tx.wait();

  console.log(`✅ Revealed purchase #${purchaseId} (reportURI=${reportURI}, methodologyURI=${methodologyURI})`);
}

main().catch(error => {
  console.error("❌ Reveal agent failed:", error);
  process.exitCode = 1;
});
