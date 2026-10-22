// Season is derived from the calendar (northern hemisphere).

export function getSeason(date = new Date()) {
  const month = date.getMonth(); // 0-11
  if (month === 11 || month <= 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  // Summer's window is folded into fall for now, at Damon's request — keep
  // the dark fall theme running straight through until winter hits in Dec.
  return "fall";
}
