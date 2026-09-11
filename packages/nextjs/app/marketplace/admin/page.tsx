"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { type PurchaseTuple, PurchaseWatcher } from "../_components/PurchaseWatcher";
import { ResolveDisputeDialog } from "../_components/ResolveDisputeDialog";
import { truncateAddress } from "../_lib/format";
import { PurchaseState } from "../_lib/purchaseState";
import { formatEther, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { Alert, AlertDescription, AlertTitle } from "~~/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~~/components/ui/tabs";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function AdminPage() {
  const { address: connectedAddress } = useAccount();
  const { data: arbiter } = useScaffoldReadContract({ contractName: "EvalMarket", functionName: "arbiter" });
  const { data: purchasesCount } = useScaffoldReadContract({
    contractName: "EvalMarket",
    functionName: "purchasesCount",
  });

  // reproductionHash isn't stored in Purchase (only emitted), so it has to be
  // read back from the Disputed event log rather than the purchases() getter.
  const { data: disputedEvents } = useScaffoldEventHistory({
    contractName: "EvalMarket",
    eventName: "Disputed",
    watch: true,
  });

  const reproductionHashByPurchaseId = useMemo(() => {
    const map = new Map<string, `0x${string}`>();
    for (const event of disputedEvents ?? []) {
      const args = event.args as { purchaseId?: bigint; reproductionHash?: `0x${string}` };
      if (args.purchaseId !== undefined && args.reproductionHash) {
        map.set(args.purchaseId.toString(), args.reproductionHash);
      }
    }
    return map;
  }, [disputedEvents]);

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

  const allPurchases = useMemo(
    () =>
      Array.from(purchasesById.entries())
        .map(([key, data]) => ({ id: BigInt(key), data }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    [purchasesById],
  );

  const pendingDisputes = allPurchases.filter(p => p.data[6] === PurchaseState.Disputed);
  const resolvedDisputes = allPurchases.filter(
    p => p.data[7].toLowerCase() !== zeroAddress && p.data[6] !== PurchaseState.Disputed,
  );

  const isArbiter = !!connectedAddress && !!arbiter && connectedAddress.toLowerCase() === arbiter.toLowerCase();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Arbiter Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resolve disputed purchases.</p>
      </div>

      {!isArbiter && (
        <Alert variant="destructive">
          <AlertTitle>You are not the arbiter</AlertTitle>
          <AlertDescription>
            Connected wallet {connectedAddress ? truncateAddress(connectedAddress) : "(not connected)"} is not the
            arbiter ({arbiter ? truncateAddress(arbiter) : "loading..."}). resolveDispute() will revert if you submit a
            ruling.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending Disputes ({pendingDisputes.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedDisputes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <DisputeTable
            purchases={pendingDisputes}
            reproductionHashByPurchaseId={reproductionHashByPurchaseId}
            showActions
          />
        </TabsContent>
        <TabsContent value="resolved">
          <DisputeTable
            purchases={resolvedDisputes}
            reproductionHashByPurchaseId={reproductionHashByPurchaseId}
            showActions={false}
          />
        </TabsContent>
      </Tabs>

      {purchasesCount !== undefined &&
        Array.from({ length: Number(purchasesCount) }).map((_, i) => (
          <PurchaseWatcher key={i} purchaseId={BigInt(i)} onData={handlePurchaseData} />
        ))}
    </div>
  );
}

function DisputeTable({
  purchases,
  reproductionHashByPurchaseId,
  showActions,
}: {
  purchases: { id: bigint; data: PurchaseTuple }[];
  reproductionHashByPurchaseId: Map<string, `0x${string}`>;
  showActions: boolean;
}) {
  if (purchases.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Nothing here yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Purchase</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Disputer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reproduction hash</TableHead>
            {showActions && <TableHead className="text-right">Ruling</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map(p => {
            const [listingId, buyer, amountPaid, , , , , disputer] = p.data;
            const reproductionHash = reproductionHashByPurchaseId.get(p.id.toString());
            return (
              <TableRow key={p.id.toString()}>
                <TableCell>#{p.id.toString()}</TableCell>
                <TableCell>
                  <Link className="text-primary underline" href={`/marketplace/${listingId.toString()}`}>
                    #{listingId.toString()}
                  </Link>
                </TableCell>
                <TableCell title={buyer}>{truncateAddress(buyer)}</TableCell>
                <TableCell title={disputer}>{truncateAddress(disputer)}</TableCell>
                <TableCell>{formatEther(amountPaid)} ETH</TableCell>
                <TableCell className="max-w-32 truncate font-mono text-xs" title={reproductionHash}>
                  {reproductionHash ?? "—"}
                </TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <ResolveDisputeDialog purchaseId={p.id} buyerWins={true} />
                      <ResolveDisputeDialog purchaseId={p.id} buyerWins={false} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
