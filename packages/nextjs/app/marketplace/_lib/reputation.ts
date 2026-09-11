// Same threshold and success-rate logic as scripts/agents/buyerAgent.ts, so
// the frontend shows sellers exactly the way the autonomous buyer judges them.
export const MIN_SUCCESS_RATE = 0.9;

export type SuccessRate = {
  /** null = unproven seller, no track record yet */
  rate: number | null;
  successfulSales: bigint;
  disputesLost: bigint;
  total: bigint;
};

export function computeSuccessRate(successfulSales: bigint, disputesLost: bigint): SuccessRate {
  const total = successfulSales + disputesLost;
  return {
    rate: total === 0n ? null : Number(successfulSales) / Number(total),
    successfulSales,
    disputesLost,
    total,
  };
}
