import { importSPKI, jwtVerify, type JWTPayload } from "jose";

export type DelegatedClaims = JWTPayload & {
  iss: string;
  aud: string | string[];
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  action: string;
  scope: string;
};

export async function verifyDelegatedRequest(input: {
  authorization: string | null;
  publicKeyPem: string;
  issuer: string;
  audience: string;
  expectedAction: string;
  expectedScope: string;
  consumeReplay: (claims: DelegatedClaims) => Promise<boolean>;
}): Promise<DelegatedClaims> {
  const token = input.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new Error("missing_bearer_assertion");
  const key = await importSPKI(input.publicKeyPem, "RS256");
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer: input.issuer,
    audience: input.audience,
    clockTolerance: 5,
    maxTokenAge: "90s",
  });
  if (
    typeof payload.sub !== "string" || typeof payload.jti !== "string" ||
    typeof payload.iat !== "number" || typeof payload.exp !== "number" ||
    typeof payload.action !== "string" || typeof payload.scope !== "string" ||
    payload.action !== input.expectedAction || payload.scope !== input.expectedScope
  ) throw new Error("invalid_delegated_claims");
  const claims = payload as DelegatedClaims;
  if (!(await input.consumeReplay(claims))) throw new Error("replayed_assertion");
  return claims;
}
