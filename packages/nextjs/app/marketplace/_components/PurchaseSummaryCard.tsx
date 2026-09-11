import Link from "next/link";
import { PURCHASE_STATE_LABELS, PurchaseState } from "../_lib/purchaseState";
import type { PurchaseTuple } from "./PurchaseWatcher";
import { RevealedPurchasePanel } from "./RevealedPurchasePanel";
import { formatEther } from "viem";
import { Badge } from "~~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~~/components/ui/card";

/**
 * One row in the "My Purchases" tab: always shows a summary, plus the
 * revealed report/methodology links for any purchase past the Paid state
 * (reportURI/methodologyURI are set once at reveal() and never cleared, so
 * they're still readable even after the purchase moves on to Disputed,
 * ReleasedToSeller, or RefundedToBuyer). Full dispute/release controls only
 * make sense while still Revealed.
 */
export function PurchaseSummaryCard({
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
  const [listingId, , amountPaid, reportURI, methodologyURI, , state] = purchase;
  const hasBeenRevealed = state !== PurchaseState.Paid;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <Link className="text-primary underline" href={`/marketplace/${listingId.toString()}`}>
            Listing #{listingId.toString()}
          </Link>
          <Badge variant="secondary">{PURCHASE_STATE_LABELS[state]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Paid {formatEther(amountPaid)} ETH — purchase #{purchaseId.toString()}
        </p>

        {!hasBeenRevealed && <p className="text-sm text-muted-foreground">Awaiting the seller to reveal the report.</p>}

        {hasBeenRevealed && state !== PurchaseState.Revealed && (
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
        )}

        {state === PurchaseState.Revealed && (
          <RevealedPurchasePanel
            purchaseId={purchaseId}
            purchase={purchase}
            challengeWindow={challengeWindow}
            disputeBond={disputeBond}
          />
        )}
      </CardContent>
    </Card>
  );
}
