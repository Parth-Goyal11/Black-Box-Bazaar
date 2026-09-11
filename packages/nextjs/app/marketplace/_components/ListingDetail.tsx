"use client";

import { useCallback, useMemo, useState } from "react";
import { formatRelativeTime, truncateAddress } from "../_lib/format";
import { PURCHASE_STATE_LABELS, PurchaseState } from "../_lib/purchaseState";
import { useCountdown } from "../_lib/useCountdown";
import { EvalCategoryBadge } from "./EvalCategoryBadge";
import { type PurchaseTuple, PurchaseWatcher } from "./PurchaseWatcher";
import { RevealedPurchasePanel } from "./RevealedPurchasePanel";
import { SuccessRateBadge } from "./SuccessRateBadge";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Alert, AlertDescription, AlertTitle } from "~~/components/ui/alert";
import { Badge } from "~~/components/ui/badge";
import { Button } from "~~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~~/components/ui/card";
import { Input } from "~~/components/ui/input";
import { Label } from "~~/components/ui/label";
import { Separator } from "~~/components/ui/separator";
import { Skeleton } from "~~/components/ui/skeleton";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function ListingDetail({ listingId: listingIdParam }: { listingId: string }) {
  let listingId: bigint;
  try {
    listingId = BigInt(listingIdParam);
  } catch {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Invalid listing id</AlertTitle>
          <AlertDescription>&quot;{listingIdParam}&quot; is not a valid listing id.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <ListingDetailInner listingId={listingId} />;
}

function ListingDetailInner({ listingId }: { listingId: bigint }) {
  const { address: connectedAddress } = useAccount();

  const { data: listing, isLoading: isListingLoading } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "listings",
    args: [listingId],
  });
  const [seller, modelName, modelVersionId, evalCategory, price, , , , validUntil, active] = listing ?? [];

  const { data: reputation } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "getReputation",
    args: [seller],
  });

  const { data: purchasesCount } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "purchasesCount",
  });
  const { data: challengeWindow } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "CHALLENGE_WINDOW",
  });
  const { data: disputeBond } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "DISPUTE_BOND",
  });

  // Collect every purchase (a listing can be bought more than once) via
  // fixed, rules-of-hooks-safe child reads, then filter down to this listing.
  const [purchasesById, setPurchasesById] = useState<Map<string, PurchaseTuple>>(new Map());
  const handlePurchaseData = useCallback((id: bigint, data: PurchaseTuple) => {
    setPurchasesById(prev => {
      const key = id.toString();
      if (prev.get(key) === data) return prev;
      const next = new Map(prev);
      next.set(key, data);
      return next;
    });
  }, []);

  const listingPurchases = useMemo(() => {
    return Array.from(purchasesById.entries())
      .map(([key, data]) => ({ id: BigInt(key), data }))
      .filter(p => p.data[0] === listingId)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [purchasesById, listingId]);

  const myOpenPurchase = useMemo(() => {
    if (!connectedAddress) return undefined;
    const mine = listingPurchases.filter(p => p.data[1].toLowerCase() === connectedAddress.toLowerCase());
    const openStates: number[] = [PurchaseState.Paid, PurchaseState.Revealed, PurchaseState.Disputed];
    const open = mine.filter(p => openStates.includes(p.data[6]));
    return open[open.length - 1];
  }, [listingPurchases, connectedAddress]);

  const sellerPendingReveal = useMemo(() => {
    const paid = listingPurchases.filter(p => p.data[6] === PurchaseState.Paid);
    return paid[paid.length - 1];
  }, [listingPurchases]);

  const otherRevealedPurchases = useMemo(() => {
    return listingPurchases.filter(p => p.data[6] === PurchaseState.Revealed && p.id !== myOpenPurchase?.id);
  }, [listingPurchases, myOpenPurchase]);

  const isSeller = !!connectedAddress && !!seller && connectedAddress.toLowerCase() === seller.toLowerCase();
  const secondsUntilExpiry = useCountdown(validUntil);
  const isExpired = secondsUntilExpiry !== null && secondsUntilExpiry < 0;
  const canPurchase = !!connectedAddress && !isSeller && active && !isExpired && !myOpenPurchase;

  const { writeContractAsync: writePurchase, isMining: isPurchasing } = useScaffoldWriteContract({
    contractName: "EvalMarket",
  });
  const handlePurchase = async () => {
    if (price === undefined) return;
    await writePurchase({ functionName: "purchase", args: [listingId], value: price });
  };

  const [reportURI, setReportURI] = useState("");
  const [methodologyURI, setMethodologyURI] = useState("");
  const { writeContractAsync: writeReveal, isMining: isRevealing } = useScaffoldWriteContract({
    contractName: "EvalMarket",
  });
  const handleReveal = async () => {
    if (!sellerPendingReveal || !reportURI || !methodologyURI) return;
    await writeReveal({
      functionName: "reveal",
      args: [sellerPendingReveal.id, reportURI, methodologyURI],
    });
    setReportURI("");
    setMethodologyURI("");
  };

  if (isListingLoading || !listing) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{modelName}</span>
            {!active && <Badge variant="destructive">Sold / withdrawn</Badge>}
            {active && isExpired && <Badge variant="secondary">Expired</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{modelVersionId}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <EvalCategoryBadge category={Number(evalCategory)} />
            {reputation && <SuccessRateBadge successfulSales={reputation[0]} disputesLost={reputation[1]} />}
          </div>
          <Separator />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Seller</dt>
            <dd className="text-right">{seller && truncateAddress(seller)}</dd>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="text-right font-medium">{formatEther(price ?? 0n)} ETH</dd>
            <dt className="text-muted-foreground">Valid until</dt>
            <dd className="text-right">{validUntil !== undefined ? formatRelativeTime(validUntil) : "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      {!connectedAddress && (
        <Alert>
          <AlertTitle>Connect a wallet</AlertTitle>
          <AlertDescription>Connect your wallet to purchase, reveal, dispute, or release funds.</AlertDescription>
        </Alert>
      )}

      {canPurchase && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase this report</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={isPurchasing} onClick={handlePurchase}>
              {isPurchasing ? "Purchasing..." : `Purchase for ${formatEther(price ?? 0n)} ETH`}
            </Button>
          </CardContent>
        </Card>
      )}

      {isSeller && sellerPendingReveal && (
        <Card>
          <CardHeader>
            <CardTitle>Reveal purchase #{sellerPendingReveal.id.toString()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reportURI">Report URI</Label>
              <Input
                id="reportURI"
                placeholder="ipfs://... or https://..."
                value={reportURI}
                onChange={e => setReportURI(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="methodologyURI">Methodology URI</Label>
              <Input
                id="methodologyURI"
                placeholder="ipfs://... or https://..."
                value={methodologyURI}
                onChange={e => setMethodologyURI(e.target.value)}
              />
            </div>
            <Button disabled={isRevealing || !reportURI || !methodologyURI} onClick={handleReveal}>
              {isRevealing ? "Revealing..." : "Reveal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {myOpenPurchase && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Your purchase #{myOpenPurchase.id.toString()}</span>
              <Badge variant="secondary">{PURCHASE_STATE_LABELS[myOpenPurchase.data[6]]}</Badge>
            </CardTitle>
          </CardHeader>
          {myOpenPurchase.data[6] === PurchaseState.Revealed && (
            <CardContent>
              <RevealedPurchasePanel
                purchaseId={myOpenPurchase.id}
                purchase={myOpenPurchase.data}
                challengeWindow={challengeWindow}
                disputeBond={disputeBond}
              />
            </CardContent>
          )}
        </Card>
      )}

      {otherRevealedPurchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Open challenges</CardTitle>
            <p className="text-sm text-muted-foreground">
              dispute() is permissionless — anyone can challenge a revealed report with evidence, not just the buyer.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {otherRevealedPurchases.map(p => (
              <RevealedPurchasePanel
                key={p.id.toString()}
                purchaseId={p.id}
                purchase={p.data}
                challengeWindow={challengeWindow}
                disputeBond={disputeBond}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {purchasesCount !== undefined &&
        Array.from({ length: Number(purchasesCount) }).map((_, i) => (
          <PurchaseWatcher key={i} purchaseId={BigInt(i)} onData={handlePurchaseData} />
        ))}
    </div>
  );
}
