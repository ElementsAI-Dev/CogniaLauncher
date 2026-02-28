use crate::host;
use crate::types::HttpResponse;
use extism_pdk::*;

/// Make an HTTP GET request to a URL (must be in allowed domains).
pub fn get(url: &str) -> Result<HttpResponse, Error> {
    let input = serde_json::json!({ "url": url }).to_string();
    let result = unsafe { host::cognia_http_get(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Make an HTTP POST request (must be in allowed domains).
pub fn post(url: &str, body: &str, content_type: Option<&str>) -> Result<HttpResponse, Error> {
    let input = serde_json::json!({
        "url": url,
        "body": body,
        "contentType": content_type.unwrap_or("application/json"),
    }).to_string();
    let result = unsafe { host::cognia_http_post(input)? };
    Ok(serde_json::from_str(&result)?)
}
