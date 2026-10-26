import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_ISSUER = "https://hajikelu.cloudflareaccess.com";
const accessJwks = createRemoteJWKSet(new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`));

/**
 * Whether `request` may reach the MCP server: it carries an Access JWT for the application identified by
 * `env.ACCESS_AUD`, or it is a local request to a development build.
 */
export async function isAuthorized(
  request: Request,
  env: { ACCESS_AUD: string; SKIP_ACCESS_AUTH?: string },
  keys: JWTVerifyGetKey = accessJwks,
): Promise<boolean> {
  // `cf deploy --mode development` would carry the bypass binding, so also require a local request.
  if ("SKIP_ACCESS_AUTH" in env && new URL(request.url).hostname === "localhost") return true;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return false;
  return jwtVerify(token, keys, { issuer: ACCESS_ISSUER, audience: env.ACCESS_AUD }).then(
    () => true,
    () => false,
  );
}
