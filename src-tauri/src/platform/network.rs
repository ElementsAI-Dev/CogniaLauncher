use futures::StreamExt;
use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("Request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("HTTP error {0}: {1}")]
    HttpStatus(u16, String),
    #[error("Timeout after {0:?}")]
    Timeout(Duration),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Rate limited, retry after {0} seconds")]
    RateLimited(u64),
    #[error("Download interrupted")]
    Interrupted,
}

pub type NetworkResult<T> = Result<T, NetworkError>;

#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub speed: f64,
}

#[derive(Debug, Clone, Default)]
pub struct RequestOptions {
    pub timeout: Option<Duration>,
    pub headers: Vec<(String, String)>,
    pub max_retries: u32,
    pub retry_delay: Duration,
}

impl RequestOptions {
    pub fn new() -> Self {
        Self {
            timeout: Some(Duration::from_secs(30)),
            max_retries: 3,
            retry_delay: Duration::from_secs(1),
            ..Default::default()
        }
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((key.into(), value.into()));
        self
    }

    pub fn with_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }
}

#[derive(Clone)]
pub struct HttpClient {
    client: Client,
    default_options: RequestOptions,
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpClient {
    pub fn new() -> Self {
        Self {
            client: super::proxy::get_shared_client(),
            default_options: RequestOptions::new(),
        }
    }

    pub fn with_options(mut self, options: RequestOptions) -> Self {
        self.default_options = options;
        self
    }

    pub fn with_proxy(self, proxy_url: Option<&str>) -> Self {
        if let Some(url) = proxy_url {
            if !url.is_empty() {
                if let Some(proxy) = super::proxy::build_proxy(Some(url), None) {
                    let client = Client::builder()
                        .proxy(proxy)
                        .timeout(Duration::from_secs(30))
                        .user_agent("CogniaLauncher/0.1.0")
                        .build()
                        .unwrap_or(self.client.clone());
                    return Self { client, ..self };
                }
            }
        }
        self
    }

    pub async fn get(&self, url: &str) -> NetworkResult<Response> {
        self.get_with_options(url, None).await
    }

    pub async fn get_with_options(
        &self,
        url: &str,
        options: Option<RequestOptions>,
    ) -> NetworkResult<Response> {
        let options = options.unwrap_or_else(|| self.default_options.clone());
        let mut attempts = 0;

        loop {
            let mut request = self.client.get(url);

            if let Some(timeout) = options.timeout {
                request = request.timeout(timeout);
            }

            for (key, value) in &options.headers {
                request = request.header(key.as_str(), value.as_str());
            }

            match request.send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return Ok(response);
                    }

                    if response.status() == StatusCode::TOO_MANY_REQUESTS {
                        let retry_after = response
                            .headers()
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(60);
                        return Err(NetworkError::RateLimited(retry_after));
                    }

                    // GitHub returns 403 (not 429) for rate limiting with x-ratelimit-remaining: 0
                    if response.status() == StatusCode::FORBIDDEN {
                        let remaining = response
                            .headers()
                            .get("x-ratelimit-remaining")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse::<u64>().ok());
                        if remaining == Some(0) {
                            let retry_after = response
                                .headers()
                                .get("x-ratelimit-reset")
                                .and_then(|v| v.to_str().ok())
                                .and_then(|v| v.parse::<u64>().ok())
                                .map(|epoch| {
                                    epoch.saturating_sub(
                                        std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_secs(),
                                    )
                                })
                                .unwrap_or(60);
                            return Err(NetworkError::RateLimited(retry_after));
                        }
                    }

                    if response.status().is_server_error() && attempts < options.max_retries {
                        attempts += 1;
                        let delay = options.retry_delay * 2u32.pow(attempts - 1);
                        tokio::time::sleep(delay).await;
                        continue;
                    }

                    return Err(NetworkError::HttpStatus(
                        response.status().as_u16(),
                        response.status().to_string(),
                    ));
                }
                Err(e) if e.is_timeout() => {
                    if attempts < options.max_retries {
                        attempts += 1;
                        let delay = options.retry_delay * 2u32.pow(attempts - 1);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(NetworkError::Timeout(options.timeout.unwrap_or_default()));
                }
                Err(e) if e.is_connect() && attempts < options.max_retries => {
                    attempts += 1;
                    let delay = options.retry_delay * 2u32.pow(attempts - 1);
                    tokio::time::sleep(delay).await;
                    continue;
                }
                Err(e) => return Err(NetworkError::Request(e)),
            }
        }
    }

    pub async fn get_json<T: for<'de> Deserialize<'de>>(&self, url: &str) -> NetworkResult<T> {
        let response = self.get(url).await?;
        let json = response.json().await?;
        Ok(json)
    }

    pub async fn post_json<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: &T,
    ) -> NetworkResult<R> {
        let response = self.client.post(url).json(body).send().await?;

        if !response.status().is_success() {
            return Err(NetworkError::HttpStatus(
                response.status().as_u16(),
                response.status().to_string(),
            ));
        }

        let json = response.json().await?;
        Ok(json)
    }

    pub async fn download<P, F>(
        &self,
        url: &str,
        dest: P,
        on_progress: Option<F>,
    ) -> NetworkResult<u64>
    where
        P: AsRef<Path>,
        F: FnMut(DownloadProgress),
    {
        self.download_with_resume(url, dest, None, on_progress)
            .await
    }

    pub async fn download_with_resume<P, F>(
        &self,
        url: &str,
        dest: P,
        resume_from: Option<u64>,
        mut on_progress: Option<F>,
    ) -> NetworkResult<u64>
    where
        P: AsRef<Path>,
        F: FnMut(DownloadProgress),
    {
        let dest = dest.as_ref();

        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let mut request = self.client.get(url);

        // Apply default headers (e.g. auth tokens for private repos)
        for (key, value) in &self.default_options.headers {
            request = request.header(key.as_str(), value.as_str());
        }

        let (mut file, start_pos) = if let Some(pos) = resume_from {
            request = request.header("Range", format!("bytes={}-", pos));
            let file = tokio::fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open(dest)
                .await?;
            (file, pos)
        } else {
            let file = File::create(dest).await?;
            (file, 0)
        };

        let response = request.send().await?;

        if !response.status().is_success() && response.status() != StatusCode::PARTIAL_CONTENT {
            return Err(NetworkError::HttpStatus(
                response.status().as_u16(),
                response.status().to_string(),
            ));
        }

        let total_size = response.content_length().map(|len| len + start_pos);
        let mut downloaded = start_pos;
        let start_time = std::time::Instant::now();

        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            if let Some(ref mut callback) = on_progress {
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (downloaded - start_pos) as f64 / elapsed
                } else {
                    0.0
                };

                callback(DownloadProgress {
                    downloaded,
                    total: total_size,
                    speed,
                });
            }
        }

        file.flush().await?;

        Ok(downloaded)
    }

    pub async fn head(&self, url: &str) -> NetworkResult<Response> {
        let response = self.client.head(url).send().await?;

        if !response.status().is_success() {
            return Err(NetworkError::HttpStatus(
                response.status().as_u16(),
                response.status().to_string(),
            ));
        }

        Ok(response)
    }

    pub async fn supports_resume(&self, url: &str) -> bool {
        if let Ok(response) = self.head(url).await {
            response
                .headers()
                .get("accept-ranges")
                .map(|v| v.to_str().unwrap_or("") == "bytes")
                .unwrap_or(false)
        } else {
            false
        }
    }
}

pub fn create_client() -> HttpClient {
    HttpClient::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_client() {
        let client = create_client();
        assert!(client.client.get("https://example.com").build().is_ok());
    }

    #[tokio::test]
    async fn test_request_options() {
        let options = RequestOptions::new()
            .with_timeout(Duration::from_secs(60))
            .with_header("Accept", "application/json")
            .with_retries(5);

        assert_eq!(options.timeout, Some(Duration::from_secs(60)));
        assert_eq!(options.max_retries, 5);
        assert_eq!(options.headers.len(), 1);
    }

    #[test]
    fn test_request_options_defaults() {
        let opts = RequestOptions::new();
        assert_eq!(opts.timeout, Some(Duration::from_secs(30)));
        assert_eq!(opts.max_retries, 3);
        assert_eq!(opts.retry_delay, Duration::from_secs(1));
        assert!(opts.headers.is_empty());
    }

    #[test]
    fn test_request_options_default_trait() {
        let opts = RequestOptions::default();
        assert_eq!(opts.timeout, None);
        assert_eq!(opts.max_retries, 0);
        assert!(opts.headers.is_empty());
    }

    #[test]
    fn test_request_options_builder_chain() {
        let opts = RequestOptions::new()
            .with_timeout(Duration::from_secs(10))
            .with_header("X-A", "1")
            .with_header("X-B", "2")
            .with_retries(0);
        assert_eq!(opts.timeout, Some(Duration::from_secs(10)));
        assert_eq!(opts.max_retries, 0);
        assert_eq!(opts.headers.len(), 2);
        assert_eq!(opts.headers[0], ("X-A".to_string(), "1".to_string()));
        assert_eq!(opts.headers[1], ("X-B".to_string(), "2".to_string()));
    }

    #[test]
    fn test_http_client_with_options() {
        let opts = RequestOptions::new().with_timeout(Duration::from_secs(120));
        let client = HttpClient::new().with_options(opts);
        assert_eq!(
            client.default_options.timeout,
            Some(Duration::from_secs(120))
        );
    }

    #[test]
    fn test_http_client_with_proxy_empty() {
        // Passing None or empty string should return the same client
        let client = HttpClient::new().with_proxy(None);
        assert!(client.client.get("https://example.com").build().is_ok());

        let client2 = HttpClient::new().with_proxy(Some(""));
        assert!(client2.client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_http_client_default_trait() {
        let client = HttpClient::default();
        assert!(client.client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_network_error_display() {
        let err = NetworkError::HttpStatus(404, "Not Found".to_string());
        let msg = format!("{}", err);
        assert!(msg.contains("404"));
        assert!(msg.contains("Not Found"));

        let err = NetworkError::Timeout(Duration::from_secs(30));
        assert!(format!("{}", err).contains("30"));

        let err = NetworkError::RateLimited(60);
        assert!(format!("{}", err).contains("60"));

        let err = NetworkError::Interrupted;
        assert!(format!("{}", err).contains("interrupted"));
    }

    #[test]
    fn test_download_progress_fields() {
        let progress = DownloadProgress {
            downloaded: 1024,
            total: Some(2048),
            speed: 512.0,
        };
        assert_eq!(progress.downloaded, 1024);
        assert_eq!(progress.total, Some(2048));
        assert!((progress.speed - 512.0).abs() < f64::EPSILON);

        let progress_no_total = DownloadProgress {
            downloaded: 100,
            total: None,
            speed: 0.0,
        };
        assert!(progress_no_total.total.is_none());
    }
}
