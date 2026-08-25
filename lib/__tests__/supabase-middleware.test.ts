import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Stub the SSR client so this test never touches a real Supabase instance —
// only the redirect/pass-through branching in updateSession is under test.
const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
  }),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

const { updateSession } = await import("@/lib/supabase/middleware");

describe("updateSession", () => {
  it("redirects an unauthenticated request on a protected path to /welcome", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/welcome");
  });

  it("does not redirect an unauthenticated request on a public path", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest("http://localhost:3000/welcome");
    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect an authenticated request on a protected path", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });
});
