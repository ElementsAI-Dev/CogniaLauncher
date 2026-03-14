use crate::host;
use crate::types::{HttpRequest, HttpResponse};
use extism_pdk::*;

/// Make an HTTP request (must be in allowed domains).
pub fn request(input: &HttpRequest) -> Result<HttpResponse, Error> {
    let payload = serde_json::json!({
        "method": input.method.clone().unwrap_or_else(|| "GET".to_string()),
        "url": input.url,
        "headers": input.headers.clone().unwrap_or_default(),
        "body": input.body,
        "contentType": input.content_type,
        "timeoutMs": input.timeout_ms,
    })
    .to_string();
    let result = unsafe { host::cognia_http_request(payload)? };
    Ok(serde_json::from_str(&result)?)
}

/// Make an HTTP GET request to a URL (must be in allowed domains).
pub fn get(url: &str) -> Result<HttpResponse, Error> {
    request(&HttpRequest {
        url: url.to_string(),
        method: Some("GET".to_string()),
        headers: None,
        body: None,
        content_type: None,
        timeout_ms: None,
    })
}

/// Make an HTTP POST request (must be in allowed domains).
pub fn post(url: &str, body: &str, content_type: Option<&str>) -> Result<HttpResponse, Error> {
    request(&HttpRequest {
        url: url.to_string(),
        method: Some("POST".to_string()),
        headers: None,
        body: Some(body.to_string()),
        content_type: Some(content_type.unwrap_or("application/json").to_string()),
        timeout_ms: None,
    })
}
