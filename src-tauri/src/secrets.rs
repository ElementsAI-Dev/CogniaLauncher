use crate::config::Settings;
use crate::platform::fs;
use std::path::PathBuf;
use tauri_plugin_stronghold::kdf::KeyDerivation;
use tauri_plugin_stronghold::stronghold::Stronghold;

const SNAPSHOT_FILE: &str = "secrets.hold";
const SALT_FILE: &str = "secrets.salt";
const CLIENT_NAME: &[u8] = b"cognia-launcher";
pub const KNOWN_SECRET_PROVIDERS: [&str; 2] = ["github", "gitlab"];

fn snapshot_file_name() -> &'static str {
    SNAPSHOT_FILE
}

fn salt_file_name() -> &'static str {
    SALT_FILE
}

pub fn provider_secret_key(provider: &str) -> String {
    format!("providers.{provider}.token")
}

pub fn provider_env_var(provider: &str) -> Option<&'static str> {
    match provider {
        "github" => Some("GITHUB_TOKEN"),
        "gitlab" => Some("GITLAB_TOKEN"),
        _ => None,
    }
}

pub fn normalized_secret(secret: Option<String>) -> Option<String> {
    secret.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub struct SecretVault {
    base_dir: PathBuf,
    snapshot_path: PathBuf,
    salt_path: PathBuf,
    stronghold: Option<Stronghold>,
}

impl Default for SecretVault {
    fn default() -> Self {
        let base_dir = fs::get_config_dir().unwrap_or_else(|| PathBuf::from("."));
        Self::new(base_dir)
    }
}

impl SecretVault {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            snapshot_path: base_dir.join(snapshot_file_name()),
            salt_path: base_dir.join(salt_file_name()),
            base_dir,
            stronghold: None,
        }
    }

    pub fn snapshot_path(&self) -> &PathBuf {
        &self.snapshot_path
    }

    pub fn salt_path(&self) -> &PathBuf {
        &self.salt_path
    }

    pub fn is_initialized(&self) -> bool {
        self.snapshot_path.exists()
    }

    pub fn is_unlocked(&self) -> bool {
        self.stronghold.is_some()
    }

    pub fn lock(&mut self) {
        self.stronghold = None;
    }

    pub async fn reset(&mut self, settings: Option<&mut Settings>) -> Result<(), String> {
        self.lock();

        if fs::exists(&self.snapshot_path).await {
            fs::remove_file(&self.snapshot_path)
                .await
                .map_err(|error| error.to_string())?;
        }

        if fs::exists(&self.salt_path).await {
            fs::remove_file(&self.salt_path)
                .await
                .map_err(|error| error.to_string())?;
        }

        if let Some(settings) = settings {
            for provider in KNOWN_SECRET_PROVIDERS {
                settings.set_provider_secret_saved(provider, false);
            }
        }

        Ok(())
    }

    pub async fn setup(&mut self, password: &str) -> Result<(), String> {
        self.open(password, true).await
    }

    pub async fn unlock(&mut self, password: &str) -> Result<(), String> {
        if !self.is_initialized() {
            return Err("Secure storage is not initialized yet.".to_string());
        }

        self.open(password, false).await
    }

    async fn open(&mut self, password: &str, allow_create: bool) -> Result<(), String> {
        let password = password.trim();
        if password.is_empty() {
            return Err("Secure storage password is required.".to_string());
        }

        fs::create_dir_all(&self.base_dir)
            .await
            .map_err(|error| error.to_string())?;

        let key = KeyDerivation::argon2(password, &self.salt_path);

        let stronghold =
            Stronghold::new(&self.snapshot_path, key).map_err(|error| error.to_string())?;

        if self.is_initialized() {
            match stronghold.load_client(CLIENT_NAME.to_vec()) {
                Ok(_) => {}
                Err(error) if allow_create => {
                    stronghold
                        .create_client(CLIENT_NAME.to_vec())
                        .map_err(|create_error| {
                            format!(
                                "Failed to load or create secure storage client: {error}; {create_error}"
                            )
                        })?;
                }
                Err(error) => {
                    return Err(error.to_string());
                }
            }
        } else if allow_create {
            stronghold
                .create_client(CLIENT_NAME.to_vec())
                .map_err(|error| error.to_string())?;
            stronghold.save().map_err(|error| error.to_string())?;
        } else {
            return Err("Secure storage is not initialized yet.".to_string());
        }

        self.stronghold = Some(stronghold);
        Ok(())
    }

    fn stronghold(&self) -> Result<&Stronghold, String> {
        self.stronghold
            .as_ref()
            .ok_or_else(|| "Secure storage is locked.".to_string())
    }

    pub fn contains_secret(&self, key: &str) -> Result<bool, String> {
        self.stronghold()?
            .get_client(CLIENT_NAME.to_vec())
            .map_err(|error| error.to_string())?
            .store()
            .contains_key(key.as_bytes())
            .map_err(|error| error.to_string())
    }

    pub fn get_secret(&self, key: &str) -> Result<Option<String>, String> {
        self.stronghold()?
            .get_client(CLIENT_NAME.to_vec())
            .map_err(|error| error.to_string())?
            .store()
            .get(key.as_bytes())
            .map_err(|error| error.to_string())?
            .map(|value| String::from_utf8(value).map_err(|error| error.to_string()))
            .transpose()
    }

    pub fn save_secret(&self, key: &str, value: &str) -> Result<(), String> {
        self.stronghold()?
            .get_client(CLIENT_NAME.to_vec())
            .map_err(|error| error.to_string())?
            .store()
            .insert(key.as_bytes().to_vec(), value.as_bytes().to_vec(), None)
            .map_err(|error| error.to_string())?;
        self.stronghold()?.save().map_err(|error| error.to_string())
    }

    pub fn remove_secret(&self, key: &str) -> Result<bool, String> {
        let existed = self.contains_secret(key)?;
        if existed {
            self.stronghold()?
                .get_client(CLIENT_NAME.to_vec())
                .map_err(|error| error.to_string())?
                .store()
                .delete(key.as_bytes())
                .map_err(|error| error.to_string())?;
            self.stronghold()?
                .save()
                .map_err(|error| error.to_string())?;
        }

        Ok(existed)
    }

    pub fn migrate_legacy_provider_tokens(
        &self,
        settings: &mut Settings,
    ) -> Result<Vec<String>, String> {
        let mut migrated = Vec::new();

        for provider in KNOWN_SECRET_PROVIDERS {
            let Some(legacy_token) = settings.get_provider_legacy_token(provider) else {
                continue;
            };

            let key = provider_secret_key(provider);
            if !self.contains_secret(&key)? {
                self.save_secret(&key, &legacy_token)?;
            }

            settings.clear_provider_legacy_token(provider);
            settings.set_provider_secret_saved(provider, true);
            migrated.push(provider.to_string());
        }

        Ok(migrated)
    }
}

#[cfg(test)]
mod tests {
    use super::{provider_secret_key, SecretVault};
    use crate::config::Settings;
    use tempfile::tempdir;

    #[tokio::test]
    async fn setup_save_read_remove_and_reset_round_trip() {
        let temp = tempdir().unwrap();
        let mut vault = SecretVault::new(temp.path().to_path_buf());

        vault.setup("secret-passphrase").await.unwrap();
        assert!(vault.is_initialized());
        assert!(vault.is_unlocked());

        let key = provider_secret_key("github");
        vault.save_secret(&key, "ghp_test123").unwrap();
        assert!(vault.contains_secret(&key).unwrap());
        assert_eq!(
            vault.get_secret(&key).unwrap().as_deref(),
            Some("ghp_test123")
        );

        assert!(vault.remove_secret(&key).unwrap());
        assert!(!vault.contains_secret(&key).unwrap());

        let mut settings = Settings::default();
        settings.set_provider_secret_saved("github", true);
        vault.reset(Some(&mut settings)).await.unwrap();

        assert!(!vault.is_initialized());
        assert!(!settings.get_provider_secret_saved("github"));
    }

    #[tokio::test]
    async fn migration_moves_legacy_tokens_without_overwriting_existing_secrets() {
        let temp = tempdir().unwrap();
        let mut vault = SecretVault::new(temp.path().to_path_buf());
        let mut settings = Settings::default();

        settings
            .set_provider_legacy_token("github", "ghp_legacy")
            .unwrap();
        settings
            .set_provider_legacy_token("gitlab", "glpat_legacy")
            .unwrap();

        vault.setup("secret-passphrase").await.unwrap();
        vault
            .save_secret(&provider_secret_key("github"), "ghp_existing")
            .unwrap();

        let migrated = vault.migrate_legacy_provider_tokens(&mut settings).unwrap();
        assert_eq!(migrated, vec!["github".to_string(), "gitlab".to_string()]);

        assert_eq!(
            vault
                .get_secret(&provider_secret_key("github"))
                .unwrap()
                .as_deref(),
            Some("ghp_existing")
        );
        assert_eq!(
            vault
                .get_secret(&provider_secret_key("gitlab"))
                .unwrap()
                .as_deref(),
            Some("glpat_legacy")
        );
        assert_eq!(settings.get_provider_legacy_token("github"), None);
        assert_eq!(settings.get_provider_legacy_token("gitlab"), None);
        assert!(settings.get_provider_secret_saved("github"));
        assert!(settings.get_provider_secret_saved("gitlab"));
    }
}
