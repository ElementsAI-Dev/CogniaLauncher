use crate::host;
use crate::types::{DirEntry, FileExistsResult};
use extism_pdk::*;

/// Read a file from the plugin's data directory.
pub fn read(path: &str) -> Result<String, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    unsafe { host::cognia_fs_read(input) }
}

/// Write content to a file in the plugin's data directory.
pub fn write(path: &str, content: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "path": path, "content": content }).to_string();
    unsafe { host::cognia_fs_write(input)?; }
    Ok(())
}

/// List files in a directory within the plugin's data directory.
pub fn list_dir(path: &str) -> Result<Vec<DirEntry>, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_fs_list_dir(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check if a file or directory exists in the plugin's data directory.
pub fn exists(path: &str) -> Result<FileExistsResult, Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    let result = unsafe { host::cognia_fs_exists(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Delete a file or directory in the plugin's data directory.
pub fn delete(path: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    unsafe { host::cognia_fs_delete(input)?; }
    Ok(())
}

/// Create a directory in the plugin's data directory.
pub fn mkdir(path: &str) -> Result<(), Error> {
    let input = serde_json::json!({ "path": path }).to_string();
    unsafe { host::cognia_fs_mkdir(input)?; }
    Ok(())
}
