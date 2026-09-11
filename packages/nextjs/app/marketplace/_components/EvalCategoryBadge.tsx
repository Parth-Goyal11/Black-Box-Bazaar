import { evalCategoryLabel } from "../_lib/evalCategory";
import { Badge } from "~~/components/ui/badge";

export function EvalCategoryBadge({ category }: { category: number }) {
  return <Badge variant="outline">{evalCategoryLabel(category)}</Badge>;
}
