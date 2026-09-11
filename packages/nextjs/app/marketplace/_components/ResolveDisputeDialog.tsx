"use client";

import { useState } from "react";
import { Button } from "~~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~~/components/ui/dialog";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function ResolveDisputeDialog({ purchaseId, buyerWins }: { purchaseId: bigint; buyerWins: boolean }) {
  const [open, setOpen] = useState(false);
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "EvalMarket" });

  const handleConfirm = async () => {
    await writeContractAsync({ functionName: "resolveDispute", args: [purchaseId, buyerWins] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={buyerWins ? "destructive" : "outline"} />}>
        {buyerWins ? "Rule for Buyer" : "Rule for Seller"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm ruling — purchase #{purchaseId.toString()}</DialogTitle>
          <DialogDescription>
            {buyerWins
              ? "The buyer is refunded, the seller's bond is slashed (split with a third-party disputer if the disputer isn't the buyer), the disputer's DISPUTE_BOND is returned, and the seller's reputation takes a hit."
              : "The seller is paid as normal, and the disputer's DISPUTE_BOND is forfeited to the seller as compensation for a frivolous dispute."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button disabled={isMining} onClick={handleConfirm}>
            {isMining ? "Submitting..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
