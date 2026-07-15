import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { withServerTiming } from "./server-timing";

describe("withServerTiming", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1123);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures duration and emits a structured log line", async () => {
    const counters = {};
    const inner = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    await withServerTiming("test-route", counters, async () => inner);
    expect(console.log).toHaveBeenCalledOnce();
    const logged = JSON.parse(
      (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(logged.route).toBe("test-route");
    expect(logged.durationMs).toBe(123);
    expect(logged.counters).toEqual({});
  });

  it("includes named counters in the log line", async () => {
    const counters = { fanout: 15 };
    const inner = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await withServerTiming("home", counters, async () => inner);
    const logged = JSON.parse(
      (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(logged.counters).toEqual({ fanout: 15 });
  });

  it("sets a well-formed Server-Timing header (duration only)", async () => {
    const counters = {};
    const inner = new Response("body", { status: 200 });
    const result = await withServerTiming(
      "search",
      counters,
      async () => inner,
    );
    const header = result.headers.get("Server-Timing");
    expect(header).toBe("search;dur=123");
  });

  it("sets a well-formed Server-Timing header with counter", async () => {
    const counters = { fanout: 20 };
    const inner = new Response("body", { status: 200 });
    const result = await withServerTiming("home", counters, async () => inner);
    const header = result.headers.get("Server-Timing");
    expect(header).toBe("home;dur=123, fanout;count=20");
  });

  it("passes the response body through byte-identical", async () => {
    const body = JSON.stringify({ yesterday: [], today: [], tomorrow: [] });
    const counters = {};
    const inner = new Response(body, { status: 200 });
    const result = await withServerTiming("home", counters, async () => inner);
    const text = await result.text();
    expect(text).toBe(body);
  });

  it("preserves the original status code", async () => {
    const counters = {};
    const inner = new Response("nope", { status: 401 });
    const result = await withServerTiming("home", counters, async () => inner);
    expect(result.status).toBe(401);
  });

  it("preserves existing response headers", async () => {
    const counters = {};
    const inner = new Response("ok", {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Custom": "value" },
    });
    const result = await withServerTiming("home", counters, async () => inner);
    expect(result.headers.get("Content-Type")).toBe("application/json");
    expect(result.headers.get("X-Custom")).toBe("value");
  });

  it("propagates errors from the wrapped handler unchanged", async () => {
    const counters = {};
    const boom = new Error("upstream exploded");
    await expect(
      withServerTiming("home", counters, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });

  it("reads counters after handler resolves (late mutation)", async () => {
    const counters: Record<string, number> = {};
    const inner = new Response("ok", { status: 200 });
    await withServerTiming("home", counters, async () => {
      // handler mutates counters during its run
      counters.fanout = 42;
      return inner;
    });
    const logged = JSON.parse(
      (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(logged.counters.fanout).toBe(42);
  });
});
