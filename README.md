# Tensor: Avenire’s Hybrid Spaced-Repetition System

**Authors:** Avenire Research Team
**Date:** 10 August, 2025

---

## Abstract

We present **Tensor**, a production-ready hybrid spaced-repetition system that combines the long-term scheduling strengths of FSRS with the fast, per-item Bayesian adaptation of Ebisu, and extends both with a compact tensor-factor modulation for user/item/context effects. Tensor is designed for privacy-sparse storage (a tiny per-card state), efficient on-device inference, and robust offline training from heterogeneous logs. This paper gives a mathematically precise description of the model, covers inference and posterior updates, explains the training pipeline (including bootstrapping and optimization choices), and documents engineering practice for running Tensor in production. We also explain why the design improves calibration, stability, and transfer across users compared with vanilla FSRS or Ebisu.

---

# 1 Introduction

Spaced repetition systems (SRS) schedule review times to maximize long-term retention given limited study time. Two widely used algorithmic ideas are:

* **FSRS (Forgetting Curve + Stability updates):** a deterministic parametric forgetting curve with per-item *stability* $S$ and *difficulty* $D$ that are updated on reviews.
* **Ebisu:** a Bayesian model that maintains a posterior over an item’s effective retention multiplier (often modeled as a log-normal multiplicative factor) and updates it using observed outcomes.

Each approach has strengths and weaknesses: FSRS is stable for long horizons but slow to adapt; Ebisu adapts quickly but can be noisy and needs careful priors. **Tensor** merges these in a principled way, then augments them with a small tensor factor that models residual user/item/context interactions multiplicatively. The result is an algorithm that (1) adapts quickly to short-term signals, (2) remains stable over long horizons, (3) requires only O(1) storage per card, and (4) is trainable from sparse logs.

This paper is written for researchers and implementers. We assume familiarity with basic probability, maximum likelihood, and Bayesian updates.

---

# 2 Related work (brief)

* FSRS family: update stability $S$ and difficulty $D$ via multiplicative or power-law rules; forgetting curve often $R(t) = r_0^{(t/S)^{w}}$ for constants $r_0$ and exponent $w$.
* Ebisu: keep a posterior on a multiplicative stability scale $m$ (log-normal prior), update with observed Bernoulli outcomes by integrating over $m$ (often with quadrature).
* Recent hybrid systems combine parametric forgetting curves with probabilistic personalization. Tensor’s main novelty is a small tensor factor that captures user/item/context variation and a training pipeline tuned to sparse logs.

---

# 3 Model overview

Tensor maintains for each card a **compact state**

$$
\mathcal{S} = \{S,\; D,\; \mu,\; \sigma^2,\; t_{\text{last}}\}
$$

where:

* $S$ — FSRS *stability* (days-like scale).
* $D$ — FSRS *difficulty* (ease factor).
* $\mu,\sigma^2$ — Ebisu log-normal posterior parameters on multiplicative multiplier $m$ (i.e. $\log m\sim\mathcal N(\mu,\sigma^2)$).
* $t_{\text{last}}$ — last review timestamp.

Tensor’s predicted recall probability at elapsed time $t$ since last review for that card is:

1. Posterior mean multiplier:

$$
\hat m = \mathbb{E}[m] = \exp(\mu + \tfrac{1}{2}\sigma^2).
$$

2. Effective stability:

$$
S_{\text{eff}} = S \cdot \hat m \cdot T(u,i,c)
$$

where $T(u,i,c)$ is a **tensor factor** (scalar > 0) modelling user $u$, item $i$ and context $c$ residual effects (see §3.3). In inference on device the tensor factor is typically folded into a per-user multiplier or is approximated as 1 if not available.

3. FSRS forgetting curve (we use a flexible power law):

$$
R(t \mid S_{\text{eff}}) \;=\; r_0^{\left(\frac{t}{S_{\text{eff}}}\right)^w}, \qquad r_0 \in (0,1),\; w>0.
$$

In practice we set $r_0=0.9$ to make $S_{\text{eff}}$ interpretable as a “typical retention scale”.

Tensor’s update after a review with graded outcome $g\in\{1,2,3,4\}$ (Again, Hard, Good, Easy) follows:

* **Ebisu posterior update** (Bayesian): compute posterior $\mu',\sigma'^2$ on $\log m$ using the likelihood of outcome under the parametric FSRS curve integrated over $\log m$ (see §4).
* **FSRS deterministic update**: update $S\leftarrow S_{\text{new}}$ and $D\leftarrow D_{\text{new}}$ using multiplicative rules dependent on $S,D,R,$ and $g$.

Finally, Tensor blends the two signals to produce the next interval. Let $I_{\text{FSRS}}=f_{\text{FSRS}}(S,D)$ (often simply $S$ scaled by difficulty) and $I_{\text{Ebisu}}$ be the interval that under the FSRS curve would produce a target retention $p_{\text{target}}$ when using $S_{\text{eff}}$. The final suggested interval is:

$$
I_{\text{final}} = (1-\alpha)\, I_{\text{FSRS}} \;+\; \alpha\, I_{\text{Ebisu}} \cdot \epsilon,
$$

where $\alpha\in[0,1]$ blends short-term Ebisu adaptation with long-term FSRS, and $\epsilon$ is a small fuzz factor (randomized ±) to avoid rigid schedules.

---

# 3.1 Forgetting curve and stability update (detailed)

Tensor adopts a flexible FSRS backbone:

$$
R(t;S,w) = r_0^{(t/S)^{w}}, \quad r_0\in(0,1),\; w>0,
$$

so $R(0)=1$ and $R(S)=r_0$. The choice $r_0=0.9$ makes $S$ a meaningful stability scale.

Stability update after a review (grade $g$):

* If failure (Again): strong shrink

  $$
  S_{\text{new}} = \max(S_{\min},\; \gamma_{\text{fail}} \cdot S)
  $$

  with $\gamma_{\text{fail}}\in(0,1)$.

* If success: multiplicative gain

  $$
  S_{\text{new}} = S \cdot \Big[1 + \text{scale}\cdot f_D(D)\cdot f_S(S)\cdot f_R(R(t,S))\cdot \text{gradeFactor}(g)\Big],
  $$

  where

  $$
  f_D(D) = \frac{1}{1 + D/k_d},\quad f_S(S)=\frac{1}{1 + S/k_s},\quad f_R(R) = (1-R)^{k_r}.
  $$

These forms are chosen because they (i) decay updates when difficulty or stability is large, (ii) amplify updates when recall probability $R$ is small (i.e. near lapses), and (iii) separate the roles of difficulty and stability.

Difficulty $D$ is updated additively toward a central prior $D_0$ with damping $d_{\text{damp}}$:

$$
D_{\text{new}} = \text{clip}\Big(D + \Delta_g \big/ (1 + d_{\text{damp}}(D-1)) + d_{\text{revert}}(D_0 - D),\; 1,\; D_{\max}\Big)
$$

where $\Delta_g$ depends on grade (fail increases difficulty, easy reduces it), and clipping ensures numerical stability.

---

# 3.2 Ebisu posterior update (mathematics)

Ebisu models uncertainty about the *multiplicative* correction $m$ applied to nominal stability. Tensor represents uncertainty with a log-normal prior for $m$:

$$
\log m \sim \mathcal{N}(\mu,\sigma^2)
$$

The likelihood of observed binary outcome $y\in\{0,1\}$ for elapsed time $t$ given $m$ is:

$$
p(y\mid m) = 
\begin{cases}
R(t\mid S\cdot m) & \text{if } y=1,\\[4pt]
1 - R(t\mid S\cdot m) & \text{if } y=0.
\end{cases}
$$

Posterior in $\log m$ is proportional to prior $\times$ likelihood. Closed form is not available; Tensor uses **Gauss–Hermite quadrature** to compute posterior moments (mean and variance of $\log m$) via importance weights:

For GH nodes $x_j$ and weights $w_j$ for the standard Gaussian measure, transform:

$$
\ell_j = \mu + \sqrt{2}\sigma x_j,\qquad m_j = \exp(\ell_j).
$$

Compute unnormalized weights $u_j = w_j\cdot p(y\mid m_j)$. Normalize: $ \tilde w_j = u_j / \sum_k u_k$. Then approximate posterior mean and variance:

$$
\mu' \approx \sum_j \tilde w_j \ell_j,\qquad (\sigma')^2 \approx \sum_j \tilde w_j(\ell_j-\mu')^2.
$$

Practical choices: 5-point GH gives an excellent tradeoff between accuracy and cost.

---

# 3.3 Tensor factor: modelling residual interactions

The name **Tensor** reflects using a multiplicative factor $T(u,i,c)$ that captures residual, compact interactions between user $u$, item $i$, and a small context $c$ (e.g. time-of-day or media type). We keep this factor simple for privacy and runtime:

* **Low-rank factorization:** $T(u,i,c) = \exp(\langle U_u, I_i, C_c\rangle)$ where $U_u,I_i,C_c$ are low-dimensional embeddings and $\langle \cdot \rangle$ denotes a triple product (contracted over small dimension $k$). In practice we often approximate $T$ as $ \exp( \langle u, i \rangle + \langle u, c \rangle)$ (sum of two dot products), because the full tensor is more expensive.

* **Privacy & deployment:** embeddings are trained offline; in production one can store only a per-user scalar multiplier (aggregated from $U_u$) or fall back to $T\equiv 1$ when privacy requires it.

* **Effect on S:** $T$ multiplies $S$, effectively shifting the whole forgetting curve for a user/item/context combination.

---

# 4 Training Tensor

Tensor is trained offline from historical review logs. The key considerations:

* Logs may be sparse and heterogeneous (different users, different retention patterns).
* Overfitting is a risk because of per-item noise and small sample sizes per item.
* Ebisu’s per-item posteriors depend on review order; training must replay sequences in order.

We use a two-stage training pipeline that proved robust in practice:

### 4.1 Objective

For a dataset of ordered review events $\{(u,i,t_k,S_{k}^{\text{pre}},D_k^{\text{pre}},y_k,g_k)\}$ (where $y_k\in\{0,1\}$ is observed success), we optimize global parameters $\theta$ (FSRS constants, tensor embeddings, and hyperparameters) to minimize **average negative log-likelihood** under per-item posterior personalization:

$$
\mathcal{L}(\theta) \;=\; \frac{1}{N}\sum_{k=1}^N -\log p_{\theta}\big(y_k \mid \text{history}_{k-1}\big),
$$

where each term is computed by (1) instantiating per-item Ebisu posterior (initialized from prior), (2) predicting recall by integrating over $m$, and (3) updating the posterior with outcome $y_k$. Crucially, computing $p_\theta(y_k\mid\text{history})$ requires Monte Carlo or quadrature integration over $m$.

### 4.2 Practical optimizer

Because $\mathcal{L}(\theta)$ can be nonconvex and sometimes noisy, we use a two-phase optimizer:

1. **Evolutionary / ES warm start** — an evolutionary search (population, multiplicative mutations) explores parameter space coupled with memoization of evaluated parameter vectors to reduce repeated computation. This is robust to noisy loss surfaces and parallelizable.

2. **Gradient fine-tune (optional)** — when $\theta$ includes differentiable embeddings and we can compute gradients via autodiff over a differentiable approximation to the GH quadrature, we fine-tune with Adam to refine embeddings and small continuous parameters.

This hybrid approach avoids local minima common in purely gradient methods and reduces the sensitivity to simulation noise.

### 4.3 Two-pass bootstrap

To reduce mismatch between synthetic training objectives and real behavior, training uses a bootstrap:

* **Pass 1:** Train on aggregated real logs (or simulated logs if real logs are scarce) to get $\theta_1$.
* **Pass 2:** Simulate new logs from $\theta_1$ (with Beta-noise added around predicted recall to mimic human variability) and re-train (or fine-tune) to obtain $\theta_2$.

This reduces variance and stabilizes the loss surface; it also helps the model generalize by learning from data generated under the model itself (self-consistency). In practice we used settings like: $N_{\text{cards}}=2000$, reviews per card $=10$ (≈20k reviews per run) aggregated across $N_{\text{bootstrap}}=5$ runs to produce a 100k sample aggregate for solid calibration.

### 4.4 Regularization & priors

* We apply L2 penalties on global parameters and embeddings.
* We use hierarchical priors for tensor embeddings (normal with small variance) to avoid overfitting to users with few interactions.
* Ebisu per-item prior $\mu_0=0,\sigma_0^2=1$ provides robustness; we occasionally tune this prior from data.

### 4.5 Evaluation metrics

We track:

* Mean negative log-likelihood (primary).
* Calibration plots: empirical recall vs predicted across bins of $t/S_{\text{eff}}$.
* Brier score.
* AUC for binary recall classification.
* Parameter stability across bootstrap runs.
* Wall-clock time for inference & training.

---

# 5 Inference & production details

Tensor is engineered for two operating modes:

1. **On-device inference (TypeScript runtime)** — minimal per-card state $\mathcal{S}$ is saved and loaded. Ebisu updates use a 5-point Gauss–Hermite integration (fast). Fuzzing, blending, and safety clamps are applied client-side. We exposed a small, dependency-free TypeScript module (see prior code) implementing `AvenireSchedulerWithMessages`.

2. **Server-side training and heavy analytics** — training runs in Python with vectorized replay and evolutionary search + Adam fine-tuning. Training artifacts (global parameters, small user embeddings if used) are exported as JSON for runtime.

### Complexity

* Per-review inference cost: $O(GH)$ for GH quadrature (GH≈5) plus a few constant arithmetic ops — fast on mobile.
* Storage per card: 5 numbers + timestamp (≈ 40–80 bytes).
* Training cost: dominated by loss evaluations across the dataset and by population size for ES; a single full training pass with 100k examples and popsize 10, n\_iters 20 is easily run on a single CPU in minutes–hours depending on implementation (vectorized).

---

# 6 Example: how training was run in our experiments (reproducible recipe)

1. **Data preparation** — prepare ordered review logs with fields: `cid, t (days), S_pre, D_pre, outcome (0/1), grade (1–4)`. If only raw logs (timestamps, intervals) exist, compute `t` as elapsed days.

2. **Aggregation & bootstrapping** — for stability aggregate multiple simulated runs (or sample subsets) to reduce per-bin variance. We used Beta-noise around predicted recall to mimic human response variation (Beta concentration parameter $\lambda\approx 60$).

3. **Evolutionary warm start** — run `evo_optimize` with:

   * popsize $=10\!-\!20$,
   * n\_iters $=20\!-\!60$,
   * multiplicative mutation sigma $≈0.12$,
   * memoize evaluated parameter vectors.

   Track best loss and history.

4. **Fine-tune with Adam** (optional) — convert the GH quadrature to a differentiable operation or use reparameterization to compute gradients; fine-tune learning rate $10^{-4}$ to $10^{-3}$.

5. **Validation** — evaluate on held-out logs and binned calibration plots (predicted vs empirical recall across $t/S_{\text{eff}}$ bins). Inspect curves: aim for near-diagonal and smooth empirical lines (bootstrapping helps).

6. **Export** — serialize final FSRS params, optional tensor embeddings, and runtime bounds (min/max stability) as JSON. Deploy to device.

---

# 7 Why Tensor is better (qualitative + analytical)

1. **Fast adaptation + long-term stability:** Ebisu quickly captures short-term deviations; FSRS prevents overreaction by providing a long-term anchor. The blend weight $\alpha$ controls this tradeoff explicitly.

2. **Personalization with small state:** Ebisu posterior provides per-item uncertainty without storing full history; the tensor factor captures systematic residual variation compactly.

3. **Calibration and robustness:** Integrating Ebisu via GH quadrature and optimizing the global parameters on aggregated, bootstrapped logs produces calibrated probabilities (empirical vs predicted close to diagonal) and reduces noisy oscillations seen with pure Ebisu.

4. **Privacy & compactness:** Minimal per-card state makes client-side deployments simple and privacy friendly.

5. **Trainability:** The two-stage (ES + gradient) and bootstrap approach makes training robust to noise and allows using simulated data to augment scarce logs.

Analytically, the model reduces variance by decomposing predicted recall uncertainty into:

* per-item posterior variance (Ebisu),
* global parametric uncertainty (FSRS),
* structured residuals captured by the tensor.

Combining multiplicatively on stability keeps the math interpretable and the inference cheap.

---

# 8 Limitations & future work

* The tensor factor increases expressivity but requires care to avoid user-level overfitting; embeddings should be regularized or aggregated to privacy-safe scalars.
* GH quadrature is efficient but can be replaced by small variational updates for additional speed or for full-differentiability.
* The two-pass bootstrap is practical but may bias training toward the model’s inductive assumptions; periodic evaluation on fresh real logs is essential.
* Multi-session and multi-device sync require careful handling of lastReview timestamps and conflict resolution.

Future directions: multi-task learning across curricula, time-varying contextual tensors, reinforcement learning objectives for time-budgeted review sequences.

---

# 9 Reproducible pseudocode (core algorithms)

## Inference (per review)

```
function applyReviewAndPredict(card_state, grade, review_ts):
    t_days = (review_ts - card_state.lastReviewTs) in days

    # Ebisu posterior update (GH quadrature)
    for j in 1..J:
        logm_j = mu + sqrt(2)*sigma * x_j
        m_j = exp(logm_j)
        S_eff_j = S * m_j * T(u,i,c)   # T approximated as 1 at runtime if missing
        p_j = R(t_days ; S_eff_j)
        w_j = w_gh[j] * (p_j if outcome==1 else 1-p_j)
    normalize w_j --> wtilde_j
    mu' = sum_j wtilde_j * logm_j
    sigma'^2 = sum_j wtilde_j * (logm_j - mu')^2

    # FSRS deterministic update
    if outcome==0:
        S_new = max(S_min, gamma_fail * S)
    else:
        Rpred = R(t_days; S)
        S_new = S * (1 + scale * fD(D) * fS(S) * fR(Rpred) * gradeFactor(grade))
    D_new = updateDifficulty(D,grade)

    # smoothing
    mu = smooth(mu, mu', smoothing)
    sigma2 = smooth(sigma2, sigma'^2, smoothing)
    S = blend(S, S_new, smoothing)
    D = D_new

    # intervals
    I_fsrs = S * difficultyScale(D)
    m_hat = exp(mu + 0.5*sigma2)
    S_eff_hat = S * m_hat
    t_power = solve_for_t_target(P_target, S_eff_hat, w)   # closed-form
    I_ebisu = t_power
    I_final = (1-alpha) * I_fsrs + alpha * I_ebisu
    apply fuzz
    clamp limits
    return updated state and I_final
```

## Training loop (sketch)

```
# data: ordered reviews per card
θ ← initial_guess
best ← θ
cache ← {}
for iter in 1..n_iters:
    candidates ← mutate_population(best, popsize, sigma)
    for c in candidates:
        key = hash_params(c)
        if key ∉ cache:
            loss = compute_loss_personalized(c, data)  # replay per-card Ebisu posteriors sequentially
            cache[key] = loss
    best = argmin_{candidates ∪ {best}} cache[c]
    optionally lower sigma
end
# optional gradient fine-tune
```

---

# 10 Conclusion

Tensor provides a practical and principled hybrid that leverages the interpretability of FSRS, the fast personalization of Ebisu, and a compact tensor residual factor for user/item/context effects. Its Bayesian per-item adaptation yields rapid responsiveness while the parametric backbone enforces long-term stability; the training recipe (ES warm-start, bootstrap aggregation, optional gradient fine-tune) produces calibrated, smooth recall predictions suitable for production deployment. The inference implementation is light enough for on-device use and respects privacy by requiring only a tiny per-card state.

---

## Appendix A — Practical hyperparameters (recommended starting point)

* Gauss-Hermite points $J=5$.
* Ebisu prior: $\mu_0=0,\;\sigma_0^2=1$.
* FSRS constants: `scale≈0.1`, `kd≈6`, `ks≈9–12`, `kr≈3–4`, `w20≈0.1–0.3`.
* ES optimizer: popsize $=10\!-\!20$, n\_iters $=20\!-\!60$, sigma $≈0.12$.
* Bootstrap: $N_{\text{cards}}≈2000$, reviews/card ≈ 5–10, $N_{\text{bootstrap}}=3\!-\!10$.
