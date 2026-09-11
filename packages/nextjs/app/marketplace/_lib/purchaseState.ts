// Mirrors the Solidity `PurchaseState` enum in packages/hardhat/contracts/Marketplace.sol.
export const PurchaseState = {
  Paid: 0,
  Revealed: 1,
  Disputed: 2,
  ReleasedToSeller: 3,
  RefundedToBuyer: 4,
} as const;

export const PURCHASE_STATE_LABELS: Record<number, string> = {
  [PurchaseState.Paid]: "Paid — awaiting reveal",
  [PurchaseState.Revealed]: "Revealed — challenge window open",
  [PurchaseState.Disputed]: "Disputed — awaiting arbiter",
  [PurchaseState.ReleasedToSeller]: "Released to seller",
  [PurchaseState.RefundedToBuyer]: "Refunded to buyer",
};
