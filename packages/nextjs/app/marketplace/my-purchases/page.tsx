"use client";

import { useCallback, useMemo, useState } from "react";
import { PurchaseSummaryCard } from "../_components/PurchaseSummaryCard";
import { type PurchaseTuple, PurchaseWatcher } from "../_components/PurchaseWatcher";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function MyPurchasesPage() {
  const { address: connectedAddress } = useAccount();

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

  const myPurchases = useMemo(() => {
    if (!connectedAddress) return [];
    return Array.from(purchasesById.entries())
      .map(([key, data]) => ({ id: BigInt(key), data }))
      .filter(p => p.data[1].toLowerCase() === connectedAddress.toLowerCase())
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [purchasesById, connectedAddress]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">My Purchases</h1>
        <p className="text-sm text-muted-foreground">Every listing you&apos;ve bought, across all statuses.</p>
      </div>

      {!connectedAddress ? (
        <p className="py-6 text-sm text-muted-foreground">Connect a wallet to see your purchases.</p>
      ) : myPurchases.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">You haven&apos;t purchased anything yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {myPurchases.map(p => (
            <PurchaseSummaryCard
              key={p.id.toString()}
              purchaseId={p.id}
              purchase={p.data}
              challengeWindow={challengeWindow}
              disputeBond={disputeBond}
            />
          ))}
        </div>
      )}

      {purchasesCount !== undefined &&
        Array.from({ length: Number(purchasesCount) }).map((_, i) => (
          <PurchaseWatcher key={i} purchaseId={BigInt(i)} onData={handlePurchaseData} />
        ))}
    </div>
  );
}
