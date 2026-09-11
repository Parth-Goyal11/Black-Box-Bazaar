"use client";

import { useEffect } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export type ListingTuple = readonly [
  seller: `0x${string}`,
  modelName: string,
  modelVersionId: string,
  evalCategory: number,
  price: bigint,
  reportHash: `0x${string}`,
  methodologyHash: `0x${string}`,
  bond: bigint,
  validUntil: bigint,
  active: boolean,
];

/**
 * Renders nothing — just reads listings(listingId) and reports the result up
 * to a parent via onData. Mirrors PurchaseWatcher: mounting one of these per
 * listingId lets a parent collect an arbitrary, dynamic number of listings
 * (e.g. to filter "your listings" by seller) while keeping each individual
 * contract read a fixed, rules-of-hooks-safe call.
 */
export function ListingWatcher({
  listingId,
  onData,
}: {
  listingId: bigint;
  onData: (listingId: bigint, data: ListingTuple) => void;
}) {
  const { data } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "listings",
    args: [listingId],
  });

  useEffect(() => {
    if (data) onData(listingId, data as unknown as ListingTuple);
  }, [data, listingId, onData]);

  return null;
}
