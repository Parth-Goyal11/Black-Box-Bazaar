import { formatDuration } from "../_lib/format";
import { Badge } from "~~/components/ui/badge";

export function CountdownBadge({ remainingSeconds }: { remainingSeconds: number }) {
  if (remainingSeconds <= 0) {
    return <Badge>Challenge window elapsed</Badge>;
  }
  return <Badge variant="secondary">{formatDuration(remainingSeconds)} remaining</Badge>;
}
