"use client";

import { useCallback, useMemo, useState } from "react";
import { type PurchaseTuple, PurchaseWatcher } from "../_components/PurchaseWatcher";
import { RevealedPurchasePanel } from "../_components/RevealedPurchasePanel";
import { PurchaseState } from "../_lib/purchaseState";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function DisputablePage() {
  const [nowMs] = useState(() => Date.now());

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

  const disputablePurchases = useMemo(() => {
    if (challengeWindow === undefined) return [];
    return Array.from(purchasesById.entries())
      .map(([key, data]) => ({ id: BigInt(key), data }))
      .filter(p => {
        if (p.data[6] !== PurchaseState.Revealed) return false;
        const releasableAtMs = (Number(p.data[5]) + Number(challengeWindow)) * 1000;
        return releasableAtMs > nowMs;
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [purchasesById, challengeWindow, nowMs]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Disputable</h1>
        <p className="text-sm text-muted-foreground">
          Revealed purchases still inside their challenge window — dispute() is permissionless, so anyone can challenge
          one with evidence, not just the buyer.
        </p>
      </div>

      {disputablePurchases.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No purchases are currently open to dispute.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {disputablePurchases.map(p => (
            <RevealedPurchasePanel
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
