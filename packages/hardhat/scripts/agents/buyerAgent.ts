import { getEvalMarketAsAgent } from "./shared.js";

/**
 * Autonomous buyer agent. Connects directly to the deployed EvalMarket
 * contract on Sepolia with ethers.js (no browser/UI), scans every listing,
 * and makes an independent go/no-go purchase decision per listing based only
 * on the seller's on-chain success rate (successfulSales / (successfulSales
 * + disputesLost)), with brand-new sellers treated as an explicit
 * unproven-but-not-guilty case.
 *
 * Run with: npx tsx scripts/agents/buyerAgent.ts
 */

const EVAL_CATEGORY_NAMES = [
  "JailbreakResistance",
  "ToolUseAccuracy",
  "HallucinationRate",
  "PromptInjectionSusceptibility",
  "Other",
];

// Minimum successRate = successfulSales / (successfulSales + disputesLost)
// required to buy from a seller. A raw `successfulSales >= disputesLost`
// check would approve e.g. 100 wins / 99 losses (a ~50% fraud rate), so we
// require an actual success-rate threshold instead.
const MIN_SUCCESS_RATE = 0.9;

async function main() {
  const { wallet, contract } = await getEvalMarketAsAgent("BUYER_AGENT_PRIVATE_KEY");
  console.log(`🤖 Buyer agent starting as ${wallet.address}`);

  const listingsCount: bigint = await contract.listingsCount();
  console.log(`🔍 Found ${listingsCount} listing(s) on-chain. Evaluating each one...\n`);

  const nowSeconds = Math.floor(Date.now() / 1000);
  let purchasedCount = 0;

  for (let i = 0n; i < listingsCount; i++) {
    const listing = await contract.listings(i);
    const { seller, modelName, modelVersionId, evalCategory, price, active, validUntil } = listing;
    const categoryName = EVAL_CATEGORY_NAMES[Number(evalCategory)] ?? `unknown(${evalCategory})`;

    console.log(`📋 Listing #${i}: "${modelName}" @ ${modelVersionId} — ${categoryName}`);

    if (!active) {
      console.log("   ⏭️  Skip: listing is not active (withdrawn by seller).\n");
      continue;
    }

    if (Number(validUntil) < nowSeconds) {
      console.log(
        `   ⏭️  Skip: listing expired at ${new Date(Number(validUntil) * 1000).toISOString()}, ` +
          "the underlying model may have drifted since this eval was run.\n",
      );
      continue;
    }

    const [successfulSales, disputesLost] = await contract.getReputation(seller);
    const totalOutcomes = successfulSales + disputesLost;

    console.log(`   📊 Seller ${seller} reputation: successfulSales=${successfulSales}, disputesLost=${disputesLost}`);

    if (totalOutcomes === 0n) {
      console.log(
        "   ℹ️  Unproven seller, no track record (0 successful sales, 0 disputes lost) — " +
          "no evidence of fraud, only absence of evidence. Proceeding.",
      );
    } else {
      const successRate = Number(successfulSales) / Number(totalOutcomes);
      const successRatePct = (successRate * 100).toFixed(1);

      if (successRate < MIN_SUCCESS_RATE) {
        console.log(
          `   ❌ Skip: successRate=${successRatePct}% (${successfulSales}/${totalOutcomes}) is below the ` +
            `${MIN_SUCCESS_RATE * 100}% threshold — too risky.\n`,
        );
        continue;
      }

      console.log(`   ✅ successRate=${successRatePct}% (${successfulSales}/${totalOutcomes}) meets the threshold.`);
    }

    console.log(`   ✅ Decision: buying at ${price} wei...`);

    const tx = await contract.purchase(i, { value: price });
    console.log(`   ⛓️  purchase() tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   🎉 Purchased listing #${i} (confirmed in block ${receipt.blockNumber})\n`);
    purchasedCount++;
  }

  console.log(`🏁 Buyer agent finished. Purchased ${purchasedCount}/${listingsCount} listing(s).`);
}

main().catch(error => {
  console.error("❌ Buyer agent failed:", error);
  process.exitCode = 1;
});
