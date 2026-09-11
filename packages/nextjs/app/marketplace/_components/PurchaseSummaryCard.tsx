import Link from "next/link";
import { PURCHASE_STATE_LABELS, PurchaseState } from "../_lib/purchaseState";
import type { PurchaseTuple } from "./PurchaseWatcher";
import { RevealedPurchasePanel } from "./RevealedPurchasePanel";
import { formatEther } from "viem";
import { Badge } from "~~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~~/components/ui/card";

/** One row in the "My Purchases" tab: summary always, full dispute/release controls when Revealed. */
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
  const [listingId, , amountPaid, , , , state] = purchase;

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
      <CardContent>
        {state === PurchaseState.Revealed ? (
          <RevealedPurchasePanel
            purchaseId={purchaseId}
            purchase={purchase}
            challengeWindow={challengeWindow}
            disputeBond={disputeBond}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Paid {formatEther(amountPaid)} ETH — purchase #{purchaseId.toString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
