interface VigRemovalResult {
  over: number;
  under: number;
}

export function removePinnacleVig(overOdd: number, underOdd: number): VigRemovalResult {
  const impliedOver = 1 / overOdd;
  const impliedUnder = 1 / underOdd;
  const totalImplied = impliedOver + impliedUnder;
  return {
    over: 1 / (impliedOver / totalImplied),
    under: 1 / (impliedUnder / totalImplied),
  };
}

export function calculateEdge({ softOdd, fairOdd }: { softOdd: number; fairOdd: number }): number {
  return (softOdd / fairOdd - 1) * 100;
}

export function calculateKelly({
  softOdd,
  fairOdd,
  bankroll,
  fractionKelly = 0.25,
}: {
  softOdd: number;
  fairOdd: number;
  bankroll: number;
  fractionKelly?: number;
}): number {
  const p = 1 / fairOdd;
  const b = softOdd - 1;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  const safeKelly = Math.max(0, kelly * fractionKelly);
  return parseFloat((safeKelly * bankroll).toFixed(2));
}
