export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type UserId = Brand<string, "UserId">;
export type ProfileId = Brand<string, "ProfileId">;
export type ProjectId = Brand<string, "ProjectId">;
export type RoomId = Brand<string, "RoomId">;
export type CircleId = Brand<string, "CircleId">;
export type CohortId = Brand<string, "CohortId">;
export type ConnectionId = Brand<string, "ConnectionId">;

export function asUserId(value: string): UserId {
  if (!value.trim()) throw new Error("UserId cannot be empty");
  return value as UserId;
}

export function createId(prefix: string, randomUUID: () => string = crypto.randomUUID): string {
  if (!/^[a-z][a-z0-9_]*$/.test(prefix)) throw new Error("Invalid id prefix");
  return `${prefix}_${randomUUID()}`;
}

export function canonicalPair(a: UserId, b: UserId): readonly [UserId, UserId] {
  if (a === b) throw new Error("A match pair requires two different users");
  return a < b ? [a, b] : [b, a];
}
