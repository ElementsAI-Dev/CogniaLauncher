use crate::config::Settings;
use crate::secrets::{normalized_secret, provider_env_var, provider_secret_key, SecretVault};
use crate::SharedSecretVault;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedSettings = Arc<RwLock<Settings>>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecretVaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub migration_pending: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSecretStatus {
    pub provider: String,
    pub configured: bool,
    pub configured_in_vault: bool,
    pub configured_in_env: bool,
    pub needs_unlock: bool,
    pub legacy_plaintext_present: bool,
}

fn has_legacy_tokens(settings: &Settings) -> bool {
    ["github", "gitlab"]
        .into_iter()
        .any(|provider| settings.get_provider_legacy_token(provider).is_some())
}

pub fn build_vault_status(settings: &Settings, vault: &SecretVault) -> SecretVaultStatus {
    SecretVaultStatus {
        initialized: vault.is_initialized(),
        unlocked: vault.is_unlocked(),
        migration_pending: has_legacy_tokens(settings),
    }
}

pub fn build_provider_secret_status(
    provider: &str,
    settings: &Settings,
    vault: &SecretVault,
) -> ProviderSecretStatus {
    let configured_in_env = provider_env_var(provider)
        .and_then(|key| std::env::var(key).ok())
        .is_some_and(|value| !value.trim().is_empty());
    let legacy_plaintext_present = settings.get_provider_legacy_token(provider).is_some();
    let configured_in_vault = settings.get_provider_secret_saved(provider) && vault.is_initialized();
    let needs_unlock = configured_in_vault && !vault.is_unlocked();

    ProviderSecretStatus {
        provider: provider.to_string(),
        configured: configured_in_vault || configured_in_env || legacy_plaintext_present,
        configured_in_vault,
        configured_in_env,
        needs_unlock,
        legacy_plaintext_present,
    }
}

pub fn resolve_provider_secret(
    provider: &str,
    explicit_token: Option<String>,
    settings: &Settings,
    vault: &SecretVault,
) -> Option<String> {
    if let Some(explicit_token) = normalized_secret(explicit_token) {
        return Some(explicit_token);
    }

    if vault.is_unlocked() {
        if let Ok(token) = vault.get_secret(&provider_secret_key(provider)) {
            if let Some(token) = normalized_secret(token) {
                return Some(token);
            }
        }
    }

    if let Some(token) = normalized_secret(settings.get_provider_legacy_token(provider)) {
        return Some(token);
    }

    provider_env_var(provider)
        .and_then(|key| std::env::var(key).ok())
        .and_then(|token| normalized_secret(Some(token)))
}

async fn migrate_after_unlock(
    settings: &State<'_, SharedSettings>,
    vault: &State<'_, SharedSecretVault>,
) -> Result<(), String> {
    let mut settings_guard = settings.write().await;
    let vault_guard = vault.write().await;
    let migrated = vault_guard.migrate_legacy_provider_tokens(&mut settings_guard)?;
    if !migrated.is_empty() {
        settings_guard.save().await.map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn secret_vault_status(
    settings: State<'_, SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<SecretVaultStatus, String> {
    let settings_guard = settings.read().await;
    let vault_guard = vault.read().await;
    Ok(build_vault_status(&settings_guard, &vault_guard))
}

#[tauri::command]
pub async fn secret_vault_setup(
    password: String,
    settings: State<'_, SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<SecretVaultStatus, String> {
    {
        let mut vault_guard = vault.write().await;
        vault_guard.setup(&password).await?;
    }
    migrate_after_unlock(&settings, &vault).await?;

    let settings_guard = settings.read().await;
    let vault_guard = vault.read().await;
    Ok(build_vault_status(&settings_guard, &vault_guard))
}

#[tauri::command]
pub async fn secret_vault_unlock(
    password: String,
    settings: State<'_, SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<SecretVaultStatus, String> {
    {
        let mut vault_guard = vault.write().await;
        vault_guard.unlock(&password).await?;
    }
    migrate_after_unlock(&settings, &vault).await?;

    let settings_guard = settings.read().await;
    let vault_guard = vault.read().await;
    Ok(build_vault_status(&settings_guard, &vault_guard))
}

#[tauri::command]
pub async fn secret_vault_lock(
    settings: State<'_, SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<SecretVaultStatus, String> {
    let settings_guard = settings.read().await;
    let mut vault_guard = vault.write().await;
    vault_guard.lock();
    Ok(build_vault_status(&settings_guard, &vault_guard))
}

#[tauri::command]
pub async fn secret_vault_reset(
    settings: State<'_, SharedSettings>,
    vault: State<'_, SharedSecretVault>,
) -> Result<SecretVaultStatus, String> {
    {
        let mut settings_guard = settings.write().await;
        let mut vault_guard = vault.write().await;
        vault_guard.reset(Some(&mut settings_guard)).await?;
        settings_guard.save().await.map_err(|error| error.to_string())?;
    }

    let settings_guard = settings.read().await;
    let vault_guard = vault.read().await;
    Ok(build_vault_status(&settings_guard, &vault_guard))
}

pub async fn provider_secret_status_internal(
    provider: &str,
    settings: &State<'_, SharedSettings>,
    vault: &State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    let settings_guard = settings.read().await;
    let vault_guard = vault.read().await;
    Ok(build_provider_secret_status(provider, &settings_guard, &vault_guard))
}

pub async fn provider_secret_save_internal(
    provider: &str,
    token: String,
    settings: &State<'_, SharedSettings>,
    vault: &State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    let token = normalized_secret(Some(token))
        .ok_or_else(|| "A non-empty token is required.".to_string())?;

    {
        let vault_guard = vault.read().await;
        if !vault_guard.is_unlocked() {
            return Err("Secure storage is locked. Set it up or unlock it before saving tokens.".to_string());
        }
    }

    {
        let mut settings_guard = settings.write().await;
        let vault_guard = vault.read().await;
        vault_guard.save_secret(&provider_secret_key(provider), &token)?;
        settings_guard.clear_provider_legacy_token(provider);
        settings_guard.set_provider_secret_saved(provider, true);
        settings_guard.save().await.map_err(|error| error.to_string())?;
    }

    provider_secret_status_internal(provider, settings, vault).await
}

pub async fn provider_secret_clear_internal(
    provider: &str,
    settings: &State<'_, SharedSettings>,
    vault: &State<'_, SharedSecretVault>,
) -> Result<ProviderSecretStatus, String> {
    {
        let mut settings_guard = settings.write().await;
        let vault_guard = vault.read().await;

        if vault_guard.is_unlocked() {
            let _ = vault_guard.remove_secret(&provider_secret_key(provider))?;
        } else if settings_guard.get_provider_secret_saved(provider) && vault_guard.is_initialized() {
            return Err("Secure storage is locked. Unlock it before clearing saved tokens.".to_string());
        }

        settings_guard.clear_provider_legacy_token(provider);
        settings_guard.set_provider_secret_saved(provider, false);
        settings_guard.save().await.map_err(|error| error.to_string())?;
    }

    provider_secret_status_internal(provider, settings, vault).await
}

#[cfg(test)]
mod tests {
    use super::{build_provider_secret_status, build_vault_status, resolve_provider_secret};
    use crate::config::Settings;
    use crate::secrets::{provider_secret_key, SecretVault};
    use tempfile::tempdir;

    #[tokio::test]
    async fn resolve_provider_secret_prefers_explicit_then_vault_then_legacy_then_env() {
        let temp = tempdir().unwrap();
        let mut vault = SecretVault::new(temp.path().to_path_buf());
        let mut settings = Settings::default();
        vault.setup("secret-passphrase").await.unwrap();
        vault
            .save_secret(&provider_secret_key("github"), "ghp_saved")
            .unwrap();

        std::env::set_var("GITHUB_TOKEN", "ghp_env");
        settings
            .set_provider_legacy_token("github", "ghp_legacy")
            .unwrap();

        let resolved = resolve_provider_secret(
            "github",
            Some("ghp_explicit".into()),
            &settings,
            &vault,
        );
        assert_eq!(resolved.as_deref(), Some("ghp_explicit"));

        let resolved = resolve_provider_secret("github", None, &settings, &vault);
        assert_eq!(resolved.as_deref(), Some("ghp_saved"));

        vault.lock();
        let resolved = resolve_provider_secret("github", None, &settings, &vault);
        assert_eq!(resolved.as_deref(), Some("ghp_legacy"));

        settings.clear_provider_legacy_token("github");
        let resolved = resolve_provider_secret("github", None, &settings, &vault);
        assert_eq!(resolved.as_deref(), Some("ghp_env"));
    }

    #[tokio::test]
    async fn provider_status_reports_locked_saved_secret_without_plaintext() {
        let temp = tempdir().unwrap();
        let mut vault = SecretVault::new(temp.path().to_path_buf());
        let mut settings = Settings::default();
        settings.set_provider_secret_saved("github", true);

        vault.setup("secret-passphrase").await.unwrap();
        vault.lock();

        let status = build_provider_secret_status("github", &settings, &vault);
        assert!(status.configured);
        assert!(status.configured_in_vault);
        assert!(status.needs_unlock);
        assert!(!status.configured_in_env);
    }

    #[tokio::test]
    async fn vault_status_reports_legacy_migration_pending() {
        let temp = tempdir().unwrap();
        let vault = SecretVault::new(temp.path().to_path_buf());
        let mut settings = Settings::default();
        settings.set_provider_legacy_token("gitlab", "glpat_legacy").unwrap();

        let status = build_vault_status(&settings, &vault);
        assert!(!status.initialized);
        assert!(!status.unlocked);
        assert!(status.migration_pending);
    }
}
