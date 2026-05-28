const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max - 1).trimEnd();
  return `${truncated}…`;
}

export function buildBenchmarkTitle(featureName: string): string {
  const candidates = [
    `${featureName} Benchmarks (2026)`,
    `${featureName} Benchmarks`,
    `${featureName} (2026)`,
    featureName,
  ];
  const fit = candidates.find((c) => c.length <= TITLE_MAX);
  return fit ?? clamp(featureName, TITLE_MAX);
}

export function buildBenchmarkDescription(
  featureName: string,
  featureDescription: string,
): string {
  const candidates = [
    `${featureDescription} Real ${featureName} performance from every brand on distribute — sortable, no cherry-picking.`,
    `${featureDescription} Real ${featureName} performance from every brand on distribute.`,
    `${featureDescription} ${featureName} performance from every brand on distribute.`,
    `Real ${featureName} performance from every brand on distribute — sortable leaderboard, no cherry-picking.`,
    `${featureName} benchmarks — real performance from every brand on distribute.`,
  ];
  const fit = candidates.find((c) => c.length <= DESCRIPTION_MAX);
  return fit ?? clamp(`${featureName} benchmarks on distribute.`, DESCRIPTION_MAX);
}
