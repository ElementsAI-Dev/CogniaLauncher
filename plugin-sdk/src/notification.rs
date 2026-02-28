use crate::host;
use extism_pdk::*;

/// Send a system notification.
pub fn send(title: &str, body: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "title": title, "body": body }).to_string();
    unsafe { host::cognia_notification_send(input)?; }
    Ok(())
}
