import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "./store";
import { institutionCacheKey, institutionCachePrefix, readThrough, segmentCacheKey } from "./index";

describe("cache keys", () => {
  it("builds a per-institution key", () => {
    expect(institutionCacheKey(42, "in_state")).toBe("ttv1:inst:42:in_state");
  });

  it("builds a prefix that covers every residency", () => {
    const prefix = institutionCachePrefix(42);
    expect(institutionCacheKey(42, "in_state").startsWith(prefix)).toBe(true);
    expect(institutionCacheKey(42, "out_of_state").startsWith(prefix)).toBe(true);
  });

  it("wildcards omitted segment dimensions", () => {
    expect(
      segmentCacheKey({
        residency: "in_state",
        sector: "public",
        institutionType: null,
        state: "CA",
      }),
    ).toBe("ttv1:seg:in_state:public:*:CA");
  });
});

describe("MemoryCacheStore", () => {
  it("stores and retrieves a value within its TTL", async () => {
    let now = 1_000;
    const store = new MemoryCacheStore(5_000, () => now);
    await store.set("k", "v", 10);
    expect(await store.get("k")).toBe("v");
    now += 9_000;
    expect(await store.get("k")).toBe("v");
  });

  it("expires a value after its TTL", async () => {
    let now = 1_000;
    const store = new MemoryCacheStore(5_000, () => now);
    await store.set("k", "v", 10);
    now += 11_000;
    expect(await store.get("k")).toBeNull();
  });

  it("returns null for an unknown key", async () => {
    const store = new MemoryCacheStore();
    expect(await store.get("missing")).toBeNull();
  });

  it("deletes a single key", async () => {
    const store = new MemoryCacheStore();
    await store.set("k", "v", 10);
    await store.delete("k");
    expect(await store.get("k")).toBeNull();
  });

  it("deletes every key under a prefix", async () => {
    const store = new MemoryCacheStore();
    await store.set("ttv1:inst:1:in_state", "a", 10);
    await store.set("ttv1:inst:1:out_of_state", "b", 10);
    await store.set("ttv1:inst:2:in_state", "c", 10);
    await store.deleteByPrefix("ttv1:inst:1:");
    expect(await store.get("ttv1:inst:1:in_state")).toBeNull();
    expect(await store.get("ttv1:inst:1:out_of_state")).toBeNull();
    expect(await store.get("ttv1:inst:2:in_state")).toBe("c");
  });

  it("evicts the oldest entry when over capacity", async () => {
    const store = new MemoryCacheStore(2);
    await store.set("a", "1", 100);
    await store.set("b", "2", 100);
    await store.set("c", "3", 100); // evicts "a"
    expect(await store.get("a")).toBeNull();
    expect(await store.get("b")).toBe("2");
    expect(await store.get("c")).toBe("3");
  });
});

describe("readThrough", () => {
  it("loads and caches on a miss, then serves the cached copy", async () => {
    const store = new MemoryCacheStore();
    let loads = 0;
    const load = async () => {
      loads += 1;
      return Promise.resolve({ value: { n: loads }, shouldCache: true });
    };

    const first = await readThrough("k", load, { ttlSeconds: 60, store });
    expect(first).toEqual({ value: { n: 1 }, cached: false });

    const second = await readThrough("k", load, { ttlSeconds: 60, store });
    expect(second).toEqual({ value: { n: 1 }, cached: true });
    expect(loads).toBe(1);
  });

  it("does not cache when the loader opts out", async () => {
    const store = new MemoryCacheStore();
    let loads = 0;
    const load = async () => {
      loads += 1;
      return Promise.resolve({ value: null, shouldCache: false });
    };

    await readThrough("k", load, { ttlSeconds: 60, store });
    await readThrough("k", load, { ttlSeconds: 60, store });
    expect(loads).toBe(2);
  });
});
