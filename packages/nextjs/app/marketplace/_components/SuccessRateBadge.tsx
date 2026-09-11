import { MIN_SUCCESS_RATE, computeSuccessRate } from "../_lib/reputation";
import { Badge } from "~~/components/ui/badge";

export function SuccessRateBadge({ successfulSales, disputesLost }: { successfulSales: bigint; disputesLost: bigint }) {
  const { rate, total } = computeSuccessRate(successfulSales, disputesLost);

  if (rate === null) {
    return (
      <Badge variant="secondary" title="No successful sales or lost disputes yet">
        Unproven seller
      </Badge>
    );
  }

  const pct = Math.round(rate * 100);
  const isGood = rate >= MIN_SUCCESS_RATE;

  return (
    <Badge
      variant={isGood ? "default" : "destructive"}
      title={`${successfulSales.toString()} successful sales, ${disputesLost.toString()} disputes lost`}
    >
      {pct}% success ({successfulSales.toString()}/{total.toString()})
    </Badge>
  );
}
