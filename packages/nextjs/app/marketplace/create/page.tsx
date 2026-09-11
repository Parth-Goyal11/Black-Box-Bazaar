"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EVAL_CATEGORY_OPTIONS, evalCategoryLabel } from "../_lib/evalCategory";
import { keccak256, parseEther, toBytes } from "viem";
import { Button } from "~~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~~/components/ui/card";
import { Input } from "~~/components/ui/input";
import { Label } from "~~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~~/components/ui/select";
import { Textarea } from "~~/components/ui/textarea";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// Sensible default: a bit more than an hour from now, in the shape
// datetime-local inputs expect (local time, no timezone/seconds).
function defaultValidUntilLocal(): string {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateListingPage() {
  const router = useRouter();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "EvalMarket" });
  const { data: minBond } = useScaffoldReadContract({ contractName: "EvalMarket", functionName: "MIN_BOND" });

  const [modelName, setModelName] = useState("");
  const [modelVersionId, setModelVersionId] = useState("");
  const [evalCategory, setEvalCategory] = useState("0");
  const [price, setPrice] = useState("0.01");
  const [validUntilLocal, setValidUntilLocal] = useState(defaultValidUntilLocal());
  const [reportContent, setReportContent] = useState("");
  const [methodologyContent, setMethodologyContent] = useState("");
  const [bond, setBond] = useState("");
  const [error, setError] = useState<string | null>(null);

  const minBondEth = minBond !== undefined ? Number(minBond) / 1e18 : undefined;
  const effectiveBond = bond || (minBondEth !== undefined ? String(minBondEth) : "");

  const reportHash = useMemo(() => (reportContent ? keccak256(toBytes(reportContent)) : undefined), [reportContent]);
  const methodologyHash = useMemo(
    () => (methodologyContent ? keccak256(toBytes(methodologyContent)) : undefined),
    [methodologyContent],
  );

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!reportHash || !methodologyHash) {
      setError("Report content and methodology content are both required.");
      return;
    }

    const bondWei = parseEther(effectiveBond || "0");
    if (minBond !== undefined && bondWei < minBond) {
      setError(`Bond must be at least ${minBondEth} ETH (MIN_BOND).`);
      return;
    }

    const validUntilMs = new Date(validUntilLocal).getTime();
    if (Number.isNaN(validUntilMs) || validUntilMs <= Date.now()) {
      setError("Valid-until must be a date/time in the future.");
      return;
    }
    const validUntil = BigInt(Math.floor(validUntilMs / 1000));

    try {
      await writeContractAsync({
        functionName: "createListing",
        args: [
          modelName,
          modelVersionId,
          Number(evalCategory),
          parseEther(price || "0"),
          reportHash,
          methodologyHash,
          validUntil,
        ],
        value: bondWei,
      });
      router.push("/marketplace");
    } catch (err) {
      // useScaffoldWriteContract already surfaces a toast notification; keep a
      // form-level message too in case the toast is missed.
      setError(err instanceof Error ? err.message : "Failed to create listing.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Create a Listing</h1>
        <p className="text-sm text-muted-foreground">
          Commit to a model evaluation report and methodology. Buyers pay before seeing the content.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Listing details</CardTitle>
            <CardDescription>These terms are public as soon as the listing is created.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modelName">Model name</Label>
                <Input
                  id="modelName"
                  placeholder="gpt-x"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modelVersionId">Model version / pinned checkpoint</Label>
                <Input
                  id="modelVersionId"
                  placeholder="gpt-x-2026-06-01"
                  value={modelVersionId}
                  onChange={e => setModelVersionId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="evalCategory">Eval category</Label>
                <Select value={evalCategory} onValueChange={value => setEvalCategory(value as string)}>
                  <SelectTrigger id="evalCategory" className="w-full">
                    <SelectValue>{(value: string | null) => evalCategoryLabel(Number(value ?? 0))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EVAL_CATEGORY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (ETH)</Label>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Valid until</Label>
              <Input
                id="validUntil"
                type="datetime-local"
                value={validUntilLocal}
                onChange={e => setValidUntilLocal(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The listing can no longer be purchased after this time — re-attest with extendValidity() if the eval
                still holds.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reportContent">Report content</Label>
              <Textarea
                id="reportContent"
                placeholder="Paste (or draft) the full evaluation report here..."
                value={reportContent}
                onChange={e => setReportContent(e.target.value)}
                required
              />
              <p className="truncate text-xs text-muted-foreground">
                reportHash: {reportHash ?? "— type content above to compute —"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="methodologyContent">Methodology content</Label>
              <Textarea
                id="methodologyContent"
                placeholder="Dataset, rubric, prompt set, scoring method..."
                value={methodologyContent}
                onChange={e => setMethodologyContent(e.target.value)}
                required
              />
              <p className="truncate text-xs text-muted-foreground">
                methodologyHash: {methodologyHash ?? "— type content above to compute —"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bond">Bond (ETH)</Label>
              <Input
                id="bond"
                type="number"
                step="any"
                min={minBondEth ?? 0}
                placeholder={minBondEth !== undefined ? String(minBondEth) : "loading MIN_BOND..."}
                value={bond}
                onChange={e => setBond(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum bond (MIN_BOND): {minBondEth !== undefined ? `${minBondEth} ETH` : "loading..."}. Leave blank to
                use the minimum.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isMining} className="w-full">
              {isMining ? "Creating listing..." : "Create Listing"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
