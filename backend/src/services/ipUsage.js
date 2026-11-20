import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "../config.js";

const GLOBAL_KEY = "__global__";
const store = new Map();
const als = new AsyncLocalStorage();

function now() {
  return Date.now();
}

function prune(bucket, windowMs, ts = now()) {
  const cutoff = ts - windowMs;
  bucket.requests = bucket.requests.filter((t) => t > cutoff);
  bucket.tokens = bucket.tokens.filter((entry) => entry.ts > cutoff);
}

function getBucket(key) {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { requests: [], tokens: [] };
    store.set(key, bucket);
  }
  return bucket;
}

function sumTokens(bucket) {
  return bucket.tokens.reduce((sum, entry) => sum + entry.n, 0);
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function usageSnapshot(ip) {
  const bucket = getBucket(ip);
  prune(bucket, config.llmRateLimitWindowMs);
  const global = getBucket(GLOBAL_KEY);
  prune(global, config.llmGlobalTokenWindowMs);
  return {
    requests: bucket.requests.length,
    tokens: sumTokens(bucket),
    requestLimit: config.llmRateLimitRequests,
    tokenLimit: config.llmRateLimitTokens,
    windowMs: config.llmRateLimitWindowMs,
    globalTokens: sumTokens(global),
    globalTokenLimit: config.llmGlobalTokenBudget,
    globalWindowMs: config.llmGlobalTokenWindowMs,
  };
}

/**
 * Reserve one LLM request for this IP. Throws an Error with status 429 if over limit.
 * Optionally pass estimatedTokens to reject early when a token budget would be exceeded.
 */
export function reserveLlmRequest(ip, { estimatedTokens = 0 } = {}) {
  const bucket = getBucket(ip);
  prune(bucket, config.llmRateLimitWindowMs);
  const tokensUsed = sumTokens(bucket);

  const global = getBucket(GLOBAL_KEY);
  prune(global, config.llmGlobalTokenWindowMs);
  const globalTokens = sumTokens(global);

  if (bucket.requests.length >= config.llmRateLimitRequests) {
    const err = new Error(
      `Rate limit: at most ${config.llmRateLimitRequests} LLM requests per hour from this IP. Try again later.`
    );
    err.status = 429;
    err.code = "rate_limit_requests";
    throw err;
  }

  if (tokensUsed >= config.llmRateLimitTokens) {
    const err = new Error(
      `Rate limit: at most ${config.llmRateLimitTokens} tokens per hour from this IP. Try again later.`
    );
    err.status = 429;
    err.code = "rate_limit_tokens";
    throw err;
  }

  if (globalTokens >= config.llmGlobalTokenBudget) {
    const err = new Error(
      `Service budget: OpenAI token budget for this period is exhausted (aligned with ~$20/month gpt-4o-mini). Try again later.`
    );
    err.status = 429;
    err.code = "rate_limit_global_tokens";
    throw err;
  }

  if (
    estimatedTokens > 0 &&
    tokensUsed + estimatedTokens > config.llmRateLimitTokens
  ) {
    const err = new Error(
      `Rate limit: this request would exceed the ${config.llmRateLimitTokens} token hourly budget for this IP.`
    );
    err.status = 429;
    err.code = "rate_limit_tokens";
    throw err;
  }

  if (
    estimatedTokens > 0 &&
    globalTokens + estimatedTokens > config.llmGlobalTokenBudget
  ) {
    const err = new Error(
      `Service budget: this request would exceed the remaining OpenAI token budget for this period.`
    );
    err.status = 429;
    err.code = "rate_limit_global_tokens";
    throw err;
  }

  bucket.requests.push(now());
  return usageSnapshot(ip);
}

export function recordTokenUsage(ip, tokens) {
  const n = Number(tokens) || 0;
  if (n <= 0 || !ip) return;
  const ts = now();
  const bucket = getBucket(ip);
  prune(bucket, config.llmRateLimitWindowMs, ts);
  bucket.tokens.push({ ts, n });

  const global = getBucket(GLOBAL_KEY);
  prune(global, config.llmGlobalTokenWindowMs, ts);
  global.tokens.push({ ts, n });
}

/** Run work with the current request IP in async context (for OpenAI usage recording). */
export function runWithClientIp(ip, fn) {
  return als.run({ ip }, fn);
}

export function recordTokensFromOpenAIUsage(usage) {
  const ip = als.getStore()?.ip;
  if (!ip || !usage) return 0;
  const total =
    Number(usage.total_tokens) ||
    (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0);
  recordTokenUsage(ip, total);
  return total;
}

/**
 * Rough preflight estimate for rate-limit reservation.
 * Orchestrated mode: 1 overview + up to 3 specialists ≈ 4 LLM calls.
 */
export function estimateTokensFromText(text, completionReserve = 4000) {
  const chars = String(text || "").length;
  const calls = config.analyzeAgentic === false ? 1 : 4;
  return Math.ceil(chars / 4) + completionReserve * calls;
}

setInterval(() => {
  const ts = now();
  for (const [key, bucket] of store.entries()) {
    const windowMs =
      key === GLOBAL_KEY
        ? config.llmGlobalTokenWindowMs
        : config.llmRateLimitWindowMs;
    prune(bucket, windowMs, ts);
    if (bucket.requests.length === 0 && bucket.tokens.length === 0) {
      store.delete(key);
    }
  }
}, 15 * 60 * 1000).unref?.();
