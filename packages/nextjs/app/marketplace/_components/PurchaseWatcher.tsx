"use client";

import { useEffect } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export type PurchaseTuple = readonly [
  listingId: bigint,
  buyer: `0x${string}`,
  amountPaid: bigint,
  reportURI: string,
  methodologyURI: string,
  revealTimestamp: bigint,
  state: number,
  disputer: `0x${string}`,
  disputeBond: bigint,
];

/**
 * Renders nothing — just reads purchases(purchaseId) and reports the result
 * up to a parent via onData. Rendering one of these per purchaseId lets the
 * parent collect an arbitrary, dynamic number of purchases while keeping
 * each individual contract read as a fixed, rules-of-hooks-safe call.
 */
export function PurchaseWatcher({
  purchaseId,
  onData,
}: {
  purchaseId: bigint;
  onData: (purchaseId: bigint, data: PurchaseTuple) => void;
}) {
  const { data } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "purchases",
    args: [purchaseId],
  });

  useEffect(() => {
    if (data) onData(purchaseId, data as unknown as PurchaseTuple);
  }, [data, purchaseId, onData]);

  return null;
}
