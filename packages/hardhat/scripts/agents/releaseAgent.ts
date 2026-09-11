import { getEvalMarketAsAgent } from "./shared.js";

/**
 * Autonomous release agent. Anyone can call releaseIfUnchallenged() once the
 * challenge window has passed, so this connects with whichever agent key is
 * available and finds the most recent purchase ready to be released.
 *
 * Run with: npx tsx scripts/agents/releaseAgent.ts
 */

const REVEALED_STATE = 1n; // PurchaseState.Revealed

async function main() {
  const { wallet, contract } = await getEvalMarketAsAgent("BUYER_AGENT_PRIVATE_KEY");
  console.log(`🚀 Release agent starting as ${wallet.address}`);

  const purchasesCount: bigint = await contract.purchasesCount();
  console.log(`🔍 Scanning ${purchasesCount} purchase(s), most recent first, for one ready to release...`);

  let purchaseId: bigint | null = null;
  let revealTimestamp: bigint | null = null;

  for (let i = purchasesCount - 1n; i >= 0n; i--) {
    const purchase = await contract.purchases(i);

    if (purchase.state !== REVEALED_STATE) {
      console.log(`   ⏭️  Purchase #${i}: state=${purchase.state}, not in Revealed state.`);
      continue;
    }

    purchaseId = i;
    revealTimestamp = purchase.revealTimestamp;
    break;
  }

  if (purchaseId === null || revealTimestamp === null) {
    console.log("✅ Nothing to release — no purchase is currently in the Revealed state.");
    return;
  }

  const challengeWindow: bigint = await contract.CHALLENGE_WINDOW();
  const releasableAt = revealTimestamp + challengeWindow;
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  if (nowSeconds < releasableAt) {
    const secondsRemaining = releasableAt - nowSeconds;
    console.log(
      `⏳ Purchase #${purchaseId} is still within its challenge window. ` +
        `${secondsRemaining} second(s) remaining before it can be released.`,
    );
    return;
  }

  console.log(`📤 Purchase #${purchaseId}'s challenge window has elapsed. Releasing funds to the seller...`);

  const tx = await contract.releaseIfUnchallenged(purchaseId);
  console.log(`⛓️  releaseIfUnchallenged() tx sent: ${tx.hash}`);
  await tx.wait();

  console.log(`✅ Released purchase #${purchaseId}.`);
}

main().catch(error => {
  console.error("❌ Release agent failed:", error);
  process.exitCode = 1;
});
