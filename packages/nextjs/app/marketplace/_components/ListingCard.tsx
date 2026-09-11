"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "../_lib/format";
import { EvalCategoryBadge } from "./EvalCategoryBadge";
import { SuccessRateBadge } from "./SuccessRateBadge";
import { formatEther } from "viem";
import { Badge } from "~~/components/ui/badge";
import { Button } from "~~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~~/components/ui/card";
import { Skeleton } from "~~/components/ui/skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export function ListingCard({ listingId }: { listingId: bigint }) {
  const [nowMs] = useState(() => Date.now());

  const { data: listing, isLoading } = useScaffoldReadContract({
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

  if (isLoading || !listing) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isExpired = validUntil !== undefined && Number(validUntil) * 1000 < nowMs;
  const isUnavailable = !active || isExpired;

  return (
    <Card className={isUnavailable ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{modelName}</span>
          {!active && <Badge variant="destructive">Sold / withdrawn</Badge>}
          {active && isExpired && <Badge variant="secondary">Expired</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{modelVersionId}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <EvalCategoryBadge category={Number(evalCategory)} />
          {reputation && <SuccessRateBadge successfulSales={reputation[0]} disputesLost={reputation[1]} />}
        </div>
        <p className="text-sm">
          Price: <span className="font-medium">{formatEther(price ?? 0n)} ETH</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Valid until: {validUntil !== undefined ? formatRelativeTime(validUntil) : "—"}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isUnavailable ? "outline" : "default"}
          nativeButton={false}
          render={<Link href={`/marketplace/${listingId}`} />}
        >
          View Listing
        </Button>
      </CardFooter>
    </Card>
  );
}
