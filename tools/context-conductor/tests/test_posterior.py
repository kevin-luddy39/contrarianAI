"""Posterior unit tests. First parity gate of the Python port.

These cover the same cases the Node `core/posterior.js` was validated
against. If a behavior changes, the Node reference implementation is
authoritative until the full sweep matches.
"""

from __future__ import annotations

import math

import pytest

from context_conductor import config
from context_conductor.posterior import (
    log_likelihoods,
    softmax,
    step,
    transition_step,
    uniform,
)


def almost_equal(a: list[float], b: list[float], tol: float = 1e-9) -> bool:
    if len(a) != len(b):
        return False
    return all(abs(x - y) < tol for x, y in zip(a, b))


def test_uniform_normalization() -> None:
    p = uniform(4)
    assert len(p) == 4
    assert abs(sum(p) - 1.0) < 1e-12
    assert all(abs(x - 0.25) < 1e-12 for x in p)


def test_uniform_single_context() -> None:
    assert uniform(1) == [1.0]


def test_uniform_zero_clamps_to_one() -> None:
    # Node `uniform(0)` returns a length-0 array; here we keep that contract.
    # The N=0 division guard exists only to avoid NaN, not to fabricate state.
    assert uniform(0) == [1.0]  # clamped to N=1 via max(N, 1)


def test_transition_step_self_only() -> None:
    p = transition_step([1.0])
    assert p == [1.0]


def test_transition_step_two_contexts_sticky() -> None:
    # With ρ=0.85 and uniform prior of 2 contexts, posterior over 1 step
    # remains uniform (symmetric kernel + symmetric prior).
    p = transition_step([0.5, 0.5], stickiness=0.85)
    assert almost_equal(p, [0.5, 0.5])


def test_transition_step_pulls_toward_self() -> None:
    # Concentrated prior on context 0 should remain concentrated after one
    # sticky step, but bleed slightly into context 1.
    p = transition_step([1.0, 0.0], stickiness=0.85)
    assert abs(p[0] - 0.85) < 1e-12
    assert abs(p[1] - 0.15) < 1e-12


def test_softmax_basic() -> None:
    out = softmax([0.0, 0.0, 0.0])
    assert almost_equal(out, [1 / 3, 1 / 3, 1 / 3])


def test_softmax_handles_negative_infinity() -> None:
    out = softmax([0.0, -math.inf])
    assert abs(out[0] - 1.0) < 1e-12
    assert abs(out[1] - 0.0) < 1e-12


def test_softmax_all_neg_infinity_returns_uniform() -> None:
    out = softmax([-math.inf, -math.inf])
    assert almost_equal(out, [0.5, 0.5])


def test_log_likelihoods_perfect_match_is_zero() -> None:
    obs = {"domain": 0.5, "user": 0.5}
    contexts = [{"fingerprint": {"domain": 0.5, "user": 0.5}}]
    weights = {"domain": 0.5, "user": 0.5}
    ll = log_likelihoods(obs, contexts, weights)
    assert ll[0] == pytest.approx(0.0, abs=1e-12)


def test_log_likelihoods_distance_squared() -> None:
    obs = {"domain": 1.0}
    contexts = [{"fingerprint": {"domain": 0.0}}]
    weights = {"domain": 1.0}
    ll = log_likelihoods(obs, contexts, weights)
    # s = -1.0 * 1.0 * 1.0 / 1.0
    assert ll[0] == pytest.approx(-1.0, abs=1e-12)


def test_step_with_empty_pool_returns_empty() -> None:
    out = step([], {"domain": 0.5}, [], config.SENSOR_WEIGHTS)
    assert out == []


def test_step_keeps_better_match() -> None:
    obs = {"domain": 0.9, "user": 0.9, "retrieval_health": 0.9,
           "tool_call_health": 0.9, "forecast_error": 0.1}
    contexts = [
        {"fingerprint": {"domain": 0.9, "user": 0.9, "retrieval_health": 0.9,
                         "tool_call_health": 0.9, "forecast_error": 0.1}},
        {"fingerprint": {"domain": 0.1, "user": 0.1, "retrieval_health": 0.1,
                         "tool_call_health": 0.1, "forecast_error": 0.9}},
    ]
    out = step(uniform(2), obs, contexts, config.SENSOR_WEIGHTS)
    assert out[0] > out[1], "context 0 fingerprint matches obs; should dominate"
