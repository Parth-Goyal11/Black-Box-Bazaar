"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ListingCard } from "./_components/ListingCard";
import { type ListingTuple, ListingWatcher } from "./_components/ListingWatcher";
import { useAccount } from "wagmi";
import { Button } from "~~/components/ui/button";
import { Skeleton } from "~~/components/ui/skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function MarketplacePage() {
  const { address: connectedAddress } = useAccount();
  const [nowMs] = useState(() => Date.now());

  const { data: listingsCount, isLoading } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "listingsCount",
  });
  const listingCount = listingsCount !== undefined ? Number(listingsCount) : undefined;

  const [listingsById, setListingsById] = useState<Map<string, ListingTuple>>(new Map());
  const handleListingData = useCallback((id: bigint, data: ListingTuple) => {
    setListingsById(prev => {
      const key = id.toString();
      if (prev.get(key) === data) return prev;
      const next = new Map(prev);
      next.set(key, data);
      return next;
    });
  }, []);

  // "Marketplace" shows only listings you can actually buy right now — active,
  // not yet expired, and not your own (the contract itself forbids buying
  // your own listing, so there's no point surfacing it here). Sold/withdrawn/
  // expired/own listings still exist and are visible under "Your Listings"
  // (for sellers) or via their direct link.
  const buyableListingIds = useMemo(() => {
    return Array.from(listingsById.entries())
      .filter(([, data]) => {
        const [seller, , , , , , , , validUntil, active] = data;
        if (!active || Number(validUntil) * 1000 <= nowMs) return false;
        if (connectedAddress && seller.toLowerCase() === connectedAddress.toLowerCase()) return false;
        return true;
      })
      .map(([key]) => BigInt(key))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [listingsById, nowMs, connectedAddress]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-muted-foreground">Model evaluation reports available to buy right now.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/marketplace/create" />}>
          Create a Listing
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : buyableListingIds.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No listings are available to buy right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buyableListingIds.map(id => (
            <ListingCard key={id.toString()} listingId={id} />
          ))}
        </div>
      )}

      {listingCount !== undefined &&
        Array.from({ length: listingCount }).map((_, i) => (
          <ListingWatcher key={i} listingId={BigInt(i)} onData={handleListingData} />
        ))}
    </div>
  );
}
