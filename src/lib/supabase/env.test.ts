import { describe, it, expect, afterEach } from "vitest";
import { getSupabaseEnv, getServiceRoleKey } from "./env";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("getSupabaseEnv", () => {
  it("returns url + anon key when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getSupabaseEnv()).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-key",
    });
  });

  it("throws a clear error when the URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws a clear error when the anon key is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("getServiceRoleKey", () => {
  it("returns the key when set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    expect(getServiceRoleKey()).toBe("service-key");
  });

  it("throws a clear error when missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
