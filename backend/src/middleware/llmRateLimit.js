import {
  clientIp,
  estimateTokensFromText,
  reserveLlmRequest,
  runWithClientIp,
} from "../services/ipUsage.js";

/**
 * Reserve a per-IP LLM slot, then run the async route handler inside IP context
 * so OpenAI usage is attributed correctly.
 */
export function withLlmRateLimit(handler) {
  return async function llmRateLimitedHandler(req, res, next) {
    const ip = clientIp(req);
    req.clientIp = ip;

    let estimatedTokens = 0;
    if (typeof req.body?.text === "string" && req.body.text.trim()) {
      estimatedTokens = estimateTokensFromText(req.body.text);
    } else if (req.file?.size) {
      estimatedTokens = estimateTokensFromText(
        "x".repeat(Math.min(Number(req.file.size) || 0, 40_000))
      );
    }

    try {
      const usage = reserveLlmRequest(ip, { estimatedTokens });
      res.setHeader("X-RateLimit-Limit-Requests", String(usage.requestLimit));
      res.setHeader(
        "X-RateLimit-Remaining-Requests",
        String(Math.max(0, usage.requestLimit - usage.requests))
      );
      res.setHeader("X-RateLimit-Limit-Tokens", String(usage.tokenLimit));
      res.setHeader(
        "X-RateLimit-Remaining-Tokens",
        String(Math.max(0, usage.tokenLimit - usage.tokens))
      );
    } catch (err) {
      res.setHeader("Retry-After", "3600");
      return res.status(err.status || 429).json({
        error: err.message || "Rate limit exceeded.",
        code: err.code || "rate_limit",
      });
    }

    try {
      await runWithClientIp(ip, () => handler(req, res, next));
    } catch (err) {
      next(err);
    }
  };
}
