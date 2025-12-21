# Tensor

Tensor is a **memory dynamics engine** for spaced repetition.

It is not a scheduler-first system, not a UI heuristic, and not a thin wrapper over FSRS.  
Tensor is built by separating **memory physics**, **policy**, and **scheduling** into strict layers, and enforcing behavior through invariants rather than assumptions.

This repository contains **Tensor v1** — a complete, invariant-locked memory engine.

---

## 1. What Tensor Is

Tensor answers one question:

> Given a review, what should memory become?

Everything else — queues, decks, UX, daily limits — is intentionally **out of scope** for v1.

Tensor is built on three principles:

1. **Memory dynamics are primary**  
   Stability is the core state. Intervals are derived.

2. **Causality is non-negotiable**  
   Recall probability must be computed *before* stability updates.  
   No post-hoc correction or scheduler feedback is allowed.

3. **Policy must be bounded and monotonic**  
   Load, fatigue, context, and “easy days” may only *dampen* learning — never amplify it unpredictably.

---

## 2. High-Level Architecture

Tensor is divided into **three strict layers**.

### 2.1 Core Memory Engine (Frozen)

This layer defines **memory physics** and must not be modified without adding new invariants.

Responsibilities:
- Compute effective recall probability
- Update stability
- Enforce bounds

Key properties:
- Single authority for stability updates
- No scheduling logic
- No card lifecycle logic
- No product assumptions

FSRS is reduced to **pure math only**:
- recall curves
- stability update equations
- difficulty update equations
- parameters

No card state, no intervals, no scheduling decisions exist here.

---

### 2.2 Policy Layer (Composable)

Policies decide **how hard we try**, not **what memory is**.

Examples of policies:
- Load pressure (backlog vs capacity)
- Adaptive retention targets
- Session momentum (fatigue)
- Day difficulty (easy / normal / hard days)
- Contextual modulation

Rules for policies:
- Must be bounded
- Must be monotonic
- Must compose multiplicatively or via soft recall shaping
- Must never override core math

Policies may influence:
- `R_eff`
- stability multipliers

Policies may NOT:
- rewrite recall curves
- rewrite stability equations
- depend on scheduler outputs

---

### 2.3 Scheduler Layer (Downstream Only)

Schedulers decide **when to review**, nothing more.

Schedulers:
- consume `S_eff`, `t_eff`, `R_eff`
- output intervals and due dates
- never mutate stability
- never recompute recall

Schedulers can be swapped freely without changing memory behavior.

---

## 3. The Canonical Review Pipeline

There is **exactly one** review pipeline in Tensor:

```
computeEffectiveState
→ load pressure
→ adaptive retention
→ updateStabilityTensor
→ apply policy multipliers
→ scheduler
```


This pipeline is:
- linear
- causal
- invariant-protected

Duplicate pipelines are forbidden.

---

## 4. Invariants (Why Tensor Is Safe)

Tensor encodes behavior as **laws**, not heuristics.

Examples:
- Early reviews never punish
- Higher load never increases stability
- Scheduler choice cannot affect stability
- Easy day ≤ normal day ≤ hard day
- Policy effects must be bounded

If an invariant fails, the change is wrong by definition.

---

## 5. What Tensor v1 Delivers

- A causally correct memory engine
- FSRS math without FSRS architectural debt
- Predictable, explainable policy effects
- Monte Carlo–validated long-term behavior
- A single, canonical review entry point

Tensor v1 is **engine-complete**.

---

## 6. What Tensor v1 Explicitly Does NOT Do

- No decks
- No queues
- No daily caps
- No UI logic
- No persistence
- No product decisions

This separation is intentional.

---

## 7. Tensor v2: Integration & Expansion

Tensor v2 is about **integration**, not redesign.

### 7.1 Decks

Decks will:
- Group cards
- Provide deck-level policy defaults
- Aggregate statistics (load, performance, capacity)

Decks do NOT:
- modify core memory math
- own scheduling logic

---

### 7.2 Queues

Queues will:
- Prioritize reviews
- Enforce daily caps
- Support easy days by deferring low-priority cards
- Manage backlog explicitly

Queues operate **above Tensor**, never inside it.

---

### 7.3 Public API (Minimal Surface)

Tensor v2 will expose a **clean, minimal API**.

Design goals:
- Explicit inputs and outputs
- One review function
- No leaking internals
- Framework-agnostic

#### Example shape (illustrative)

```ts
review({
  memoryState,
  reviewOutcome,
  policyContext,
  now
}) → {
  newMemoryState,
  schedulingSuggestion
}
```

Tensor does not own:

* persistence
* UI state
* user identity
* deck membership

---

### 7.4 Project Integration

Tensor v2 is designed to:

* Plug into higher-level systems
* Power decks, queues, and dashboards
* Remain independent of UI and storage choices

Tensor should be usable:

* in a backend service
* in a client app
* in simulations and research tools

---

## 8. What Will NOT Change in v2

* Core memory math
* Stability update logic
* Recall computation
* Invariants

Tensor v1 is frozen. v2 builds *around* it.

---

## 9. Mental Model to Keep

* Tensor decides **what memory becomes**
* Policies decide **how hard we try**
* Schedulers decide **when we ask again**
* Products decide **what users see**

Breaking this separation reintroduces silent bugs.

---

## 10. Status

* Tensor v1: ✅ complete
* Tensor v2: 🔜 decks, queues, clean API

---

If this document feels more like an engine spec than a feature list, that is intentional.
