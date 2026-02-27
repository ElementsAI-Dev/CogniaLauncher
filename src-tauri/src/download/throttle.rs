//! Speed limiting for downloads using token bucket algorithm

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Token bucket for rate limiting
#[derive(Debug)]
struct TokenBucket {
    /// Maximum tokens (bytes) the bucket can hold
    capacity: u64,
    /// Current tokens available
    tokens: u64,
    /// Rate at which tokens are added (bytes per second)
    rate: u64,
    /// Last time tokens were added
    last_update: Instant,
}

impl TokenBucket {
    fn new(rate: u64) -> Self {
        Self {
            capacity: rate * 2, // Allow burst of 2 seconds worth
            tokens: rate * 2,
            rate,
            last_update: Instant::now(),
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_update);
        let new_tokens = (elapsed.as_secs_f64() * self.rate as f64) as u64;

        if new_tokens > 0 {
            self.tokens = (self.tokens + new_tokens).min(self.capacity);
            self.last_update = now;
        }
    }

    fn try_consume(&mut self, amount: u64) -> Option<u64> {
        self.refill();

        if self.tokens >= amount {
            self.tokens -= amount;
            Some(amount)
        } else if self.tokens > 0 {
            let available = self.tokens;
            self.tokens = 0;
            Some(available)
        } else {
            None
        }
    }

    fn time_to_available(&self, amount: u64) -> Duration {
        if self.tokens >= amount {
            Duration::ZERO
        } else {
            let needed = amount - self.tokens;
            Duration::from_secs_f64(needed as f64 / self.rate as f64)
        }
    }
}

/// Speed limiter for controlling download bandwidth
#[derive(Clone)]
pub struct SpeedLimiter {
    bucket: Arc<Mutex<Option<TokenBucket>>>,
    enabled: Arc<std::sync::atomic::AtomicBool>,
}

impl Default for SpeedLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl SpeedLimiter {
    /// Create a new speed limiter (disabled by default)
    pub fn new() -> Self {
        Self {
            bucket: Arc::new(Mutex::new(None)),
            enabled: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Create a speed limiter with a specific rate limit
    pub fn with_limit(bytes_per_second: u64) -> Self {
        let limiter = Self::new();
        limiter.set_limit(bytes_per_second);
        limiter
    }

    /// Set the speed limit in bytes per second (0 to disable)
    pub fn set_limit(&self, bytes_per_second: u64) {
        let bucket = if bytes_per_second > 0 {
            self.enabled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            Some(TokenBucket::new(bytes_per_second))
        } else {
            self.enabled
                .store(false, std::sync::atomic::Ordering::SeqCst);
            None
        };

        // Use try_lock to avoid blocking, if can't get lock, spawn a task
        if let Ok(mut guard) = self.bucket.try_lock() {
            *guard = bucket;
        } else {
            let bucket_clone = self.bucket.clone();
            tokio::spawn(async move {
                let mut guard = bucket_clone.lock().await;
                *guard = bucket;
            });
        }
    }

    /// Check if the limiter is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Acquire permission to transfer bytes, returns how many bytes can be transferred
    /// This will wait if necessary to respect the rate limit
    pub async fn acquire(&self, requested_bytes: u64) -> u64 {
        if !self.is_enabled() {
            return requested_bytes;
        }

        loop {
            let mut guard = self.bucket.lock().await;
            if let Some(ref mut bucket) = *guard {
                if let Some(granted) = bucket.try_consume(requested_bytes) {
                    return granted;
                }

                // Wait for tokens to become available
                let wait_time = bucket.time_to_available(requested_bytes.min(bucket.capacity));
                drop(guard);

                if wait_time > Duration::ZERO {
                    tokio::time::sleep(wait_time.min(Duration::from_millis(100))).await;
                }
            } else {
                return requested_bytes;
            }
        }
    }

    /// Try to acquire bytes without waiting, returns None if not enough tokens
    pub async fn try_acquire(&self, requested_bytes: u64) -> Option<u64> {
        if !self.is_enabled() {
            return Some(requested_bytes);
        }

        let mut guard = self.bucket.lock().await;
        if let Some(ref mut bucket) = *guard {
            bucket.try_consume(requested_bytes)
        } else {
            Some(requested_bytes)
        }
    }

    /// Get the current rate limit (0 if disabled)
    pub async fn get_limit(&self) -> u64 {
        let guard = self.bucket.lock().await;
        guard.as_ref().map(|b| b.rate).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_bucket_new() {
        let bucket = TokenBucket::new(1000);
        assert_eq!(bucket.rate, 1000);
        assert_eq!(bucket.capacity, 2000);
        assert_eq!(bucket.tokens, 2000);
    }

    #[test]
    fn test_token_bucket_consume() {
        let mut bucket = TokenBucket::new(1000);

        // Should be able to consume up to capacity
        let consumed = bucket.try_consume(1500);
        assert_eq!(consumed, Some(1500));
        assert_eq!(bucket.tokens, 500);

        // Should consume remaining
        let consumed = bucket.try_consume(1000);
        assert_eq!(consumed, Some(500));
        assert_eq!(bucket.tokens, 0);

        // Should return None when empty
        let consumed = bucket.try_consume(100);
        assert_eq!(consumed, None);
    }

    #[tokio::test]
    async fn test_speed_limiter_disabled() {
        let limiter = SpeedLimiter::new();
        assert!(!limiter.is_enabled());

        let granted = limiter.acquire(1000).await;
        assert_eq!(granted, 1000);
    }

    #[tokio::test]
    async fn test_speed_limiter_enabled() {
        let limiter = SpeedLimiter::with_limit(1000);
        assert!(limiter.is_enabled());

        // Should get some bytes immediately (from initial burst capacity)
        let granted = limiter.acquire(500).await;
        assert!(granted > 0);
    }

    #[tokio::test]
    async fn test_speed_limiter_set_limit() {
        let limiter = SpeedLimiter::new();
        assert!(!limiter.is_enabled());

        limiter.set_limit(5000);
        // Give async task time to complete
        tokio::time::sleep(Duration::from_millis(10)).await;
        assert!(limiter.is_enabled());
        assert_eq!(limiter.get_limit().await, 5000);

        limiter.set_limit(0);
        tokio::time::sleep(Duration::from_millis(10)).await;
        assert!(!limiter.is_enabled());
    }

    #[tokio::test]
    async fn test_speed_limiter_try_acquire() {
        let limiter = SpeedLimiter::with_limit(1000);

        // Should succeed initially
        let result = limiter.try_acquire(100).await;
        assert!(result.is_some());

        // Exhaust the bucket
        while limiter.try_acquire(1000).await.is_some() {}

        // Now try_acquire should fail
        let result = limiter.try_acquire(1000).await;
        assert!(result.is_none());
    }

    #[test]
    fn test_token_bucket_time_to_available_sufficient() {
        let bucket = TokenBucket::new(1000);
        // Bucket starts full (2000 tokens), requesting 500 should be instant
        let wait = bucket.time_to_available(500);
        assert_eq!(wait, Duration::ZERO);
    }

    #[test]
    fn test_token_bucket_time_to_available_insufficient() {
        let mut bucket = TokenBucket::new(1000);
        // Drain all tokens
        bucket.tokens = 0;
        let wait = bucket.time_to_available(500);
        // Need 500 tokens at 1000/s → 0.5s
        assert!(wait.as_secs_f64() > 0.4 && wait.as_secs_f64() < 0.6);
    }

    #[test]
    fn test_token_bucket_partial_consume() {
        let mut bucket = TokenBucket::new(1000);
        bucket.tokens = 300;
        // Request 500, only 300 available → returns 300
        let consumed = bucket.try_consume(500);
        assert_eq!(consumed, Some(300));
        assert_eq!(bucket.tokens, 0);
    }

    #[test]
    fn test_token_bucket_consume_exact() {
        let mut bucket = TokenBucket::new(1000);
        bucket.tokens = 500;
        let consumed = bucket.try_consume(500);
        assert_eq!(consumed, Some(500));
        assert_eq!(bucket.tokens, 0);
    }

    #[tokio::test]
    async fn test_speed_limiter_default() {
        let limiter = SpeedLimiter::default();
        assert!(!limiter.is_enabled());
        assert_eq!(limiter.get_limit().await, 0);
    }

    #[tokio::test]
    async fn test_speed_limiter_with_limit_get_limit() {
        let limiter = SpeedLimiter::with_limit(5000);
        assert!(limiter.is_enabled());
        assert_eq!(limiter.get_limit().await, 5000);
    }

    #[tokio::test]
    async fn test_speed_limiter_try_acquire_disabled_returns_full() {
        let limiter = SpeedLimiter::new();
        assert!(!limiter.is_enabled());
        let result = limiter.try_acquire(99999).await;
        assert_eq!(result, Some(99999));
    }

    #[tokio::test]
    async fn test_speed_limiter_acquire_disabled_returns_full() {
        let limiter = SpeedLimiter::new();
        let granted = limiter.acquire(12345).await;
        assert_eq!(granted, 12345);
    }
}
