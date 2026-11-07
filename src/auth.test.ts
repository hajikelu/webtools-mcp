import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

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

const log = mock.method(console, "error", () => {});
beforeEach(() => log.mock.resetCalls());

// The tests compare this whole, so one fails if a log line carries anything from the JWT, such as its email.
function logged() {
  return log.mock.calls.map((call) => call.arguments);
}

function request(token?: string, url = "https://webtools.example.test/mcp") {
  return new Request(url, { headers: token ? { "cf-access-jwt-assertion": token } : {} });
}

test("accepts a JWT signed by Access for this application", async () => {
  assert.equal(await isAuthorized(request(await sign()), ENV, keys), true);
  assert.deepEqual(logged(), []);
});

test("rejects a request without the Access header", async () => {
  assert.equal(await isAuthorized(request(), ENV, keys), false);
  assert.deepEqual(logged(), []);
});

test("rejects a JWT for another Access application", async () => {
  assert.equal(
    await isAuthorized(request(await sign({ audience: "other-aud" })), ENV, keys),
    false,
  );
  assert.deepEqual(logged(), [["auth", "ERR_JWT_CLAIM_VALIDATION_FAILED", "aud"]]);
});

test("rejects a JWT from another issuer", async () => {
  const token = await sign({ issuer: "https://other.cloudflareaccess.com" });
  assert.equal(await isAuthorized(request(token), ENV, keys), false);
  assert.deepEqual(logged(), [["auth", "ERR_JWT_CLAIM_VALIDATION_FAILED", "iss"]]);
});

test("rejects an expired JWT", async () => {
  const token = await sign({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await isAuthorized(request(token), ENV, keys), false);
  assert.deepEqual(logged(), [["auth", "ERR_JWT_EXPIRED", "exp"]]);
});

test("rejects a JWT whose payload was changed after signing", async () => {
  const [header, , signature] = (await sign()).split(".");
  const payload = Buffer.from(
    JSON.stringify({ email: "attacker@example.test", iss: ACCESS_ISSUER, aud: AUD }),
  ).toString("base64url");
  assert.equal(await isAuthorized(request(`${header}.${payload}.${signature}`), ENV, keys), false);
  assert.deepEqual(logged(), [["auth", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", ""]]);
});

test("rejects a JWT when the keys can't be fetched, and logs that", async () => {
  const unreachable = async () => {
    throw new TypeError("fetch failed");
  };
  assert.equal(await isAuthorized(request(await sign()), ENV, unreachable), false);
  assert.deepEqual(logged(), [["auth", "TypeError", ""]]);
});

test("logs the name of an error whose code is only a number", async () => {
  const unusable = async () => {
    throw new DOMException("bad key", "DataError");
  };
  assert.equal(await isAuthorized(request(await sign()), ENV, unusable), false);
  assert.deepEqual(logged(), [["auth", "DataError", ""]]);
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
