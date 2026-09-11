"use client";

import { useState } from "react";
import Link from "next/link";
import { useCountdown } from "../_lib/useCountdown";
import { CountdownBadge } from "./CountdownBadge";
import type { PurchaseTuple } from "./PurchaseWatcher";
import { keccak256, toBytes } from "viem";
import { Button } from "~~/components/ui/button";
import { Input } from "~~/components/ui/input";
import { Label } from "~~/components/ui/label";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

/**
 * Dispute + release controls for a Revealed purchase. dispute() is
 * permissionless in the EvalMarket contract (a fraud-proof-style challenge
 * open to any third party, not just the buyer), and anyone can call
 * releaseIfUnchallenged() once the window elapses, so this panel doesn't
 * gate either action to the buyer — it's shown to whichever wallet is
 * connected.
 */
export function RevealedPurchasePanel({
  purchaseId,
  purchase,
  challengeWindow,
  disputeBond,
}: {
  purchaseId: bigint;
  purchase: PurchaseTuple;
  challengeWindow: bigint | undefined;
  disputeBond: bigint | undefined;
}) {
  const [listingId, buyer, , reportURI, methodologyURI, revealTimestamp] = purchase;
  const releasableAt = challengeWindow !== undefined ? revealTimestamp + challengeWindow : undefined;
  const remaining = useCountdown(releasableAt);

  const [reproductionText, setReproductionText] = useState("");
  const { writeContractAsync: writeDispute, isMining: isDisputing } = useScaffoldWriteContract({
    contractName: "EvalMarket",
  });
  const { writeContractAsync: writeRelease, isMining: isReleasing } = useScaffoldWriteContract({
    contractName: "EvalMarket",
  });

  const handleDispute = async () => {
    if (disputeBond === undefined || !reproductionText) return;
    const reproductionHash = keccak256(toBytes(reproductionText));
    await writeDispute({
      functionName: "dispute",
      args: [purchaseId, reproductionHash],
      value: disputeBond,
    });
    setReproductionText("");
  };

  const handleRelease = async () => {
    await writeRelease({ functionName: "releaseIfUnchallenged", args: [purchaseId] });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">
        Purchase #{purchaseId.toString()} on{" "}
        <Link className="text-primary underline" href={`/marketplace/${listingId.toString()}`}>
          listing #{listingId.toString()}
        </Link>{" "}
        — buyer {buyer}
      </p>

      <div className="flex flex-col gap-1 text-sm">
        <p>
          Report:{" "}
          <a className="text-primary underline" href={reportURI} target="_blank" rel="noreferrer">
            {reportURI}
          </a>
        </p>
        <p>
          Methodology:{" "}
          <a className="text-primary underline" href={methodologyURI} target="_blank" rel="noreferrer">
            {methodologyURI}
          </a>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {remaining !== null && <CountdownBadge remainingSeconds={remaining} />}
        <Button
          size="sm"
          variant="outline"
          disabled={remaining === null || remaining > 0 || isReleasing}
          onClick={handleRelease}
        >
          {isReleasing ? "Releasing..." : "Release Payment"}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label htmlFor={`reproduction-${purchaseId}`}>Dispute: describe your reproduction attempt</Label>
        <Input
          id={`reproduction-${purchaseId}`}
          placeholder="What did you try, and how did the result differ?"
          value={reproductionText}
          onChange={e => setReproductionText(e.target.value)}
        />
        <Button
          size="sm"
          variant="destructive"
          disabled={!reproductionText || isDisputing || disputeBond === undefined}
          onClick={handleDispute}
        >
          {isDisputing
            ? "Submitting dispute..."
            : `Dispute (stake ${disputeBond !== undefined ? Number(disputeBond) / 1e18 : "…"} ETH)`}
        </Button>
      </div>
    </div>
  );
}
