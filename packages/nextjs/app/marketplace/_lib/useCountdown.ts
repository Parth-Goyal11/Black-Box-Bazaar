"use client";

import { useEffect, useState } from "react";

/** Ticks once a second and returns seconds remaining until targetUnixSeconds (negative once elapsed). */
export function useCountdown(targetUnixSeconds: bigint | undefined): number | null {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (targetUnixSeconds === undefined) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [targetUnixSeconds]);

  if (targetUnixSeconds === undefined) return null;
  return Number(targetUnixSeconds) - now;
}
