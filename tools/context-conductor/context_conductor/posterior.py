"""Switching state-space posterior over P(context_i is best | observations).

Models the agent's working context as a discrete latent variable
c_t in {1..N}. Each turn we observe sensor signals y_t, and update

    P(c_t = i | y_{1..t}) ∝ P(y_t | c_t = i) · Σ_j P(c_t = i | c_{t-1} = j) P(c_{t-1} = j | y_{1..t-1})

Transition kernel is sticky (whitepaper §3.1):

    P(c_t = i | c_{t-1} = j) = ρ · 𝟙[i=j] + (1-ρ)/(N-1) · 𝟙[i≠j]

Observation likelihood per context is the weighted similarity between
the current turn's sensor profile and the saved context's
sensor-profile fingerprint, mapped to a probability via softmax.

Whitepaper §3.1.

Port note: numerics use numpy for vectorization; algorithmic shape
preserved exactly from Node `core/posterior.js`.
"""

from __future__ import annotations

import math
from typing import Iterable, Mapping, Sequence

import numpy as np

from context_conductor.config import STICKY_SELF_PRIOR


def transition_step(
    prior: Sequence[float],
    stickiness: float = STICKY_SELF_PRIOR,
) -> list[float]:
    n = len(prior)
    if n == 0:
        return []
    if n == 1:
        return [1.0]
    off = (1.0 - stickiness) / (n - 1)
    out = [0.0] * n
    for i in range(n):
        for j in range(n):
            p = stickiness if i == j else off
            out[i] += p * prior[j]
    return out


def log_likelihoods(
    obs: Mapping[str, float],
    contexts: Sequence[Mapping],
    weights: Mapping[str, float],
) -> list[float]:
    """Compute observation log-likelihood per context.

    obs        : normalized observation vector for the current turn
                 keys: domain, user, retrieval_health, tool_call_health, forecast_error
                 each in [0, 1]; forecast_error is raw error.
    contexts   : pool entries; each must have a 'fingerprint' mapping with the
                 same keys as obs (their last-known healthy profile).
    weights    : sensor weights from config.SENSOR_WEIGHTS.
    Returns    : list of log-likelihoods, length len(contexts).
    """
    out: list[float] = []
    for c in contexts:
        f = c.get("fingerprint", {}) or {}
        s = 0.0
        wsum = 0.0
        for k, w in weights.items():
            o = obs.get(k)
            fv = f.get(k)
            if o is None or fv is None:
                continue
            ovr = abs(o - fv)
            s += -w * ovr * ovr
            wsum += w
        out.append(s / wsum if wsum > 0 else -math.inf)
    return out


def softmax(logp: Sequence[float]) -> list[float]:
    if len(logp) == 0:
        return []
    finite = [x for x in logp if math.isfinite(x)]
    if not finite:
        return [1.0 / len(logp)] * len(logp)
    m = max(finite)
    exps = [math.exp(x - m) if math.isfinite(x) else 0.0 for x in logp]
    s = sum(exps)
    if s == 0.0:
        return [1.0 / len(logp)] * len(logp)
    return [e / s for e in exps]


def step(
    prior: Sequence[float],
    obs: Mapping[str, float],
    contexts: Sequence[Mapping],
    weights: Mapping[str, float],
) -> list[float]:
    """One Bayes update step."""
    if len(contexts) == 0:
        return []
    predicted = transition_step(prior)
    ll = log_likelihoods(obs, contexts, weights)
    lp = [l + math.log(max(predicted[i], 1e-12)) for i, l in enumerate(ll)]
    return softmax(lp)


def uniform(n: int) -> list[float]:
    n = max(n, 1)
    return [1.0 / n] * n
