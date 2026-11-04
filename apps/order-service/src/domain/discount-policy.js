export function discountForScore(score) {
  const value = Number(score) || 0;
  if (value >= 1000) return 15;
  if (value >= 500) return 10;
  if (value >= 100) return 5;
  return 0;
}

