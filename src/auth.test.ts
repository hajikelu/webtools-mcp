import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

import { ACCESS_ISSUER, isAuthorized } from "./auth.ts";

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

const ENV = { ACCESS_AUD: AUD };

function request(token?: string, url = "https://webtools.example.test/mcp") {
  return new Request(url, { headers: token ? { "cf-access-jwt-assertion": token } : {} });
}

test("accepts a JWT signed by Access for this application", async () => {
  assert.equal(await isAuthorized(request(await sign()), ENV, keys), true);
});

test("rejects a request without the Access header", async () => {
  assert.equal(await isAuthorized(request(), ENV, keys), false);
});

test("rejects a JWT for another Access application", async () => {
  assert.equal(
    await isAuthorized(request(await sign({ audience: "other-aud" })), ENV, keys),
    false,
  );
});

test("rejects a JWT from another issuer", async () => {
  const token = await sign({ issuer: "https://other.cloudflareaccess.com" });
  assert.equal(await isAuthorized(request(token), ENV, keys), false);
});

test("rejects an expired JWT", async () => {
  const token = await sign({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await isAuthorized(request(token), ENV, keys), false);
});

test("rejects a JWT whose payload was changed after signing", async () => {
  const [header, , signature] = (await sign()).split(".");
  const payload = Buffer.from(
    JSON.stringify({ email: "attacker@example.test", iss: ACCESS_ISSUER, aud: AUD }),
  ).toString("base64url");
  assert.equal(await isAuthorized(request(`${header}.${payload}.${signature}`), ENV, keys), false);
});

const DEV_ENV = { ...ENV, SKIP_ACCESS_AUTH: "1" };

test("lets a local request to a development build through without a JWT", async () => {
  assert.equal(
    await isAuthorized(request(undefined, "http://localhost:5173/mcp"), DEV_ENV, keys),
    true,
  );
});

test("asks a development build for a JWT when the request isn't local", async () => {
  assert.equal(await isAuthorized(request(), DEV_ENV, keys), false);
  assert.equal(await isAuthorized(request(await sign()), DEV_ENV, keys), true);
});

test("asks a production build for a JWT even on a local request", async () => {
  assert.equal(
    await isAuthorized(request(undefined, "http://localhost:5173/mcp"), ENV, keys),
    false,
  );
});
