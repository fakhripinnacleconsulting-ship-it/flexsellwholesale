import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Allow local fallback if Redis URL is not set or is a dummy value
let ratelimit: Ratelimit | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (
  redisUrl && 
  redisToken && 
  !redisUrl.includes("your-database-name") &&
  !redisToken.includes("your_upstash_redis_token")
) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests per minute
    analytics: true,
  });
}

// In-memory fallback for development and single-instance deployments.
// WARNING: This fallback is per-process — in multi-instance deployments (e.g. Vercel
// serverless, K8s), each instance tracks limits independently. For production at scale,
// configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
const fallbackMap = new Map<string, { count: number; resetTime: number }>();
let cleanupCounter = 0;
function cleanupExpired() {
  if (++cleanupCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [key, entry] of fallbackMap) {
    if (now > entry.resetTime) fallbackMap.delete(key);
  }
}

export async function rateLimit(identifier: string) {
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(identifier);
      if (!success) {
        throw new Error("Rate limit exceeded");
      }
      return;
    } catch (err: any) {
      if (err.message === "Rate limit exceeded") throw err;
      console.warn("Upstash Redis error, falling back to local rate limit:", err.message);
      // Fall through to fallback behavior
    }
  }

  // Fallback behavior
  cleanupExpired();
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 5;

  let record = fallbackMap.get(identifier);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  if (record.count >= maxRequests) {
    throw new Error("Rate limit exceeded");
  }

  record.count++;
  fallbackMap.set(identifier, record);
}
