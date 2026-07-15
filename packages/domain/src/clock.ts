export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(instant: Date | string | number): Clock {
  const value = new Date(instant);
  if (Number.isNaN(value.valueOf())) throw new Error("Invalid fixed clock instant");
  return { now: () => new Date(value) };
}
