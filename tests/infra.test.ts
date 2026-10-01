import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "@/lib/client-ip";
import { isSerializationConflict } from "@/lib/db-errors";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/api/x", { headers });

describe("clientIp: the address the trusted proxy saw", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it("ignores client-supplied entries on the left (anti-spoofing)", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
  });
  it("uses the single entry when there is no proxy chain", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.4" }))).toBe(
      "198.51.100.4"
    );
  });
  it("counts TRUSTED_PROXY_HOPS from the right for proxy chains", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(
      clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" }))
    ).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then one shared bucket (fail closed)", () => {
    expect(clientIp(req({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("isSerializationConflict: both pg-adapter shapes", () => {
  it("recognises P2034 (conflict during a query)", () => {
    expect(isSerializationConflict({ code: "P2034" })).toBe(true);
  });
  it("recognises a DriverAdapterError at commit", () => {
    expect(
      isSerializationConflict({
        name: "DriverAdapterError",
        message: "TransactionWriteConflict",
        cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
      })
    ).toBe(true);
  });
  it("doesn't swallow other errors", () => {
    expect(isSerializationConflict(new Error("connection refused"))).toBe(
      false
    );
    expect(isSerializationConflict({ code: "P2002" })).toBe(false);
    expect(isSerializationConflict(null)).toBe(false);
  });
});
