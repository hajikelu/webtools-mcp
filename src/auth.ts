// `node --test` runs this module by stripping types: keep it to erasable syntax, import with the `.ts`
// extension, and leave out Workers-only modules such as `cloudflare:workers`.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_ISSUER = "https://hajikelu.cloudflareaccess.com";
export const accessJwks = createRemoteJWKSet(new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`));

/** Whether `token` is an Access JWT for the application identified by `audience`. */
export async function verifyAccessJwt(
  token: string | null,
  keys: JWTVerifyGetKey,
  audience: string,
): Promise<boolean> {
  if (!token) return false;
  return jwtVerify(token, keys, { issuer: ACCESS_ISSUER, audience }).then(
    () => true,
    () => false,
  );
}
