interface ArbResult {
  arbPct: number;
  stakes: { over: number; under: number };
  profit: number;
}

export function detectArbitrage({
  overOdd,
  underOdd,
  bankroll,
}: {
  overOdd: number;
  underOdd: number;
  bankroll: number;
}): ArbResult | null {
  const impliedSum = 1 / overOdd + 1 / underOdd;
  if (impliedSum >= 1) return null;

  const arbPct = (1 - impliedSum) * 100;
  const stakeOver = bankroll / (overOdd * impliedSum);
  const stakeUnder = bankroll / (underOdd * impliedSum);
  const profit = bankroll * (1 / impliedSum - 1);

  return {
    arbPct: parseFloat(arbPct.toFixed(2)),
    stakes: {
      over: parseFloat(stakeOver.toFixed(2)),
      under: parseFloat(stakeUnder.toFixed(2)),
    },
    profit: parseFloat(profit.toFixed(2)),
  };
}
