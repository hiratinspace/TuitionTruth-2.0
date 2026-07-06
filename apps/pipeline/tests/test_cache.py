from tuitiontruth_pipeline.cache.memory import InMemoryCache


def test_get_returns_none_and_counts_miss() -> None:
    cache = InMemoryCache(clock=lambda: 0.0)
    assert cache.get("k") is None
    assert cache.misses == 1
    assert cache.hits == 0


def test_set_then_get_hits() -> None:
    now = {"t": 0.0}
    cache = InMemoryCache(clock=lambda: now["t"])
    cache.set("k", "v", ttl_seconds=10)
    assert cache.get("k") == "v"
    assert cache.hits == 1


def test_entry_expires_after_ttl() -> None:
    now = {"t": 0.0}
    cache = InMemoryCache(clock=lambda: now["t"])
    cache.set("k", "v", ttl_seconds=10)
    now["t"] = 10.0
    assert cache.get("k") is None


def test_delete_removes_entry() -> None:
    cache = InMemoryCache(clock=lambda: 0.0)
    cache.set("k", "v", ttl_seconds=10)
    cache.delete("k")
    assert cache.get("k") is None


def test_hit_ratio() -> None:
    now = {"t": 0.0}
    cache = InMemoryCache(clock=lambda: now["t"])
    cache.get("miss")
    cache.set("k", "v", ttl_seconds=10)
    cache.get("k")
    assert cache.hit_ratio == 0.5
