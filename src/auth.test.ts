import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

import { ACCESS_ISSUER, verifyAccessJwt } from "./auth.ts";

const AUD = "test-aud";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "RS256" }] });

function sign({
  issuer = ACCESS_ISSUER,
  audience = AUD,
  expiresIn = "5m" as string | number,
} = {}) {
  return new SignJWT({ email: "user@example.test" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

test("accepts a JWT signed by Access for this application", async () => {
  assert.equal(await verifyAccessJwt(await sign(), keys, AUD), true);
});

test("rejects a request without the Access header", async () => {
  assert.equal(await verifyAccessJwt(null, keys, AUD), false);
});

test("rejects a JWT for another Access application", async () => {
  assert.equal(await verifyAccessJwt(await sign({ audience: "other-aud" }), keys, AUD), false);
});

test("rejects a JWT from another issuer", async () => {
  const token = await sign({ issuer: "https://other.cloudflareaccess.com" });
  assert.equal(await verifyAccessJwt(token, keys, AUD), false);
});

test("rejects an expired JWT", async () => {
  const token = await sign({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await verifyAccessJwt(token, keys, AUD), false);
});

test("rejects a JWT whose payload was changed after signing", async () => {
  const [header, , signature] = (await sign()).split(".");
  const payload = Buffer.from(
    JSON.stringify({ email: "attacker@example.test", iss: ACCESS_ISSUER, aud: AUD }),
  ).toString("base64url");
  assert.equal(await verifyAccessJwt(`${header}.${payload}.${signature}`, keys, AUD), false);
});
