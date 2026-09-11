"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ListingCard } from "../_components/ListingCard";
import { type ListingTuple, ListingWatcher } from "../_components/ListingWatcher";
import { useAccount } from "wagmi";
import { Button } from "~~/components/ui/button";
import { Skeleton } from "~~/components/ui/skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function YourListingsPage() {
  const { address: connectedAddress } = useAccount();

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

  const yourListingIds = useMemo(() => {
    if (!connectedAddress) return [];
    return Array.from(listingsById.entries())
      .filter(([, data]) => data[0].toLowerCase() === connectedAddress.toLowerCase())
      .map(([key]) => BigInt(key))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [listingsById, connectedAddress]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Listings</h1>
          <p className="text-sm text-muted-foreground">
            Every listing you&apos;ve created as a seller, including sold and withdrawn ones.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/marketplace/create" />}>
          Create a Listing
        </Button>
      </div>

      {!connectedAddress ? (
        <p className="py-6 text-sm text-muted-foreground">Connect a wallet to see your listings.</p>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : yourListingIds.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">You haven&apos;t created any listings yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {yourListingIds.map(id => (
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
