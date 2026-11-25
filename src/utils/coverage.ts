export type CoverageZone = "ok" | "near" | "below";

/** Зона покрытия: выше порога на 10+ п.п. — спокойно, до 10 п.п. — у порога, ниже — риск */
export const coverageZone = (percent: number, threshold: number): CoverageZone => {
  if (percent < threshold) return "below";
  if (percent < threshold + 10) return "near";
  return "ok";
};
