// Mirrors the Solidity `EvalCategory` enum in packages/hardhat/contracts/Marketplace.sol.
export const EVAL_CATEGORY_LABELS = [
  "Jailbreak Resistance",
  "Tool Use Accuracy",
  "Hallucination Rate",
  "Prompt Injection Susceptibility",
  "Other",
] as const;

export const EVAL_CATEGORY_OPTIONS = EVAL_CATEGORY_LABELS.map((label, value) => ({ value, label }));

export function evalCategoryLabel(value: number): string {
  return EVAL_CATEGORY_LABELS[value] ?? `Unknown (${value})`;
}
