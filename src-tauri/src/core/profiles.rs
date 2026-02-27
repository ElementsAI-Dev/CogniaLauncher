use crate::error::{CogniaError, CogniaResult};
use crate::provider::ProviderRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// An environment version specification within a profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileEnvironment {
    pub env_type: String,
    pub version: String,
    pub provider_id: Option<String>,
}

/// An environment profile containing multiple environment configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub environments: Vec<ProfileEnvironment>,
    pub created_at: String,
    pub updated_at: String,
}

impl EnvironmentProfile {
    pub fn new(name: impl Into<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            description: None,
            environments: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_environment(&mut self, env: ProfileEnvironment) {
        // Remove existing environment of the same type
        self.environments.retain(|e| e.env_type != env.env_type);
        self.environments.push(env);
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn remove_environment(&mut self, env_type: &str) {
        self.environments.retain(|e| e.env_type != env_type);
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}

/// Result of applying a profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileApplyResult {
    pub profile_id: String,
    pub profile_name: String,
    pub successful: Vec<ProfileEnvironmentResult>,
    pub failed: Vec<ProfileEnvironmentError>,
    pub skipped: Vec<ProfileEnvironmentSkipped>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileEnvironmentResult {
    pub env_type: String,
    pub version: String,
    pub provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileEnvironmentError {
    pub env_type: String,
    pub version: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileEnvironmentSkipped {
    pub env_type: String,
    pub version: String,
    pub reason: String,
}

/// Profile manager for storing and applying environment profiles
pub struct ProfileManager {
    profiles: HashMap<String, EnvironmentProfile>,
    storage_path: PathBuf,
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl ProfileManager {
    pub fn new(storage_path: PathBuf, registry: Arc<RwLock<ProviderRegistry>>) -> Self {
        Self {
            profiles: HashMap::new(),
            storage_path,
            registry,
        }
    }

    /// Load profiles from storage
    pub async fn load(&mut self) -> CogniaResult<()> {
        let profiles_file = self.storage_path.join("profiles.json");

        if profiles_file.exists() {
            let content = crate::platform::fs::read_file_string(&profiles_file).await?;
            self.profiles = serde_json::from_str(&content)
                .map_err(|e| CogniaError::Parse(format!("Failed to parse profiles: {}", e)))?;
        }

        Ok(())
    }

    /// Save profiles to storage
    pub async fn save(&self) -> CogniaResult<()> {
        let profiles_file = self.storage_path.join("profiles.json");

        // Ensure directory exists
        if let Some(parent) = profiles_file.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let content = serde_json::to_string_pretty(&self.profiles)
            .map_err(|e| CogniaError::Parse(format!("Failed to serialize profiles: {}", e)))?;

        crate::platform::fs::write_file_string(&profiles_file, &content).await?;

        Ok(())
    }

    /// List all profiles
    pub fn list(&self) -> Vec<EnvironmentProfile> {
        self.profiles.values().cloned().collect()
    }

    /// Get a profile by ID
    pub fn get(&self, id: &str) -> Option<EnvironmentProfile> {
        self.profiles.get(id).cloned()
    }

    /// Create a new profile
    pub async fn create(
        &mut self,
        profile: EnvironmentProfile,
    ) -> CogniaResult<EnvironmentProfile> {
        if self.profiles.contains_key(&profile.id) {
            return Err(CogniaError::Provider(format!(
                "Profile with ID {} already exists",
                profile.id
            )));
        }

        self.profiles.insert(profile.id.clone(), profile.clone());
        self.save().await?;

        Ok(profile)
    }

    /// Update an existing profile
    pub async fn update(
        &mut self,
        profile: EnvironmentProfile,
    ) -> CogniaResult<EnvironmentProfile> {
        if !self.profiles.contains_key(&profile.id) {
            return Err(CogniaError::Provider(format!(
                "Profile with ID {} not found",
                profile.id
            )));
        }

        let mut updated = profile.clone();
        updated.updated_at = chrono::Utc::now().to_rfc3339();

        self.profiles.insert(updated.id.clone(), updated.clone());
        self.save().await?;

        Ok(updated)
    }

    /// Delete a profile
    pub async fn delete(&mut self, id: &str) -> CogniaResult<()> {
        if self.profiles.remove(id).is_none() {
            return Err(CogniaError::Provider(format!(
                "Profile with ID {} not found",
                id
            )));
        }

        self.save().await?;
        Ok(())
    }

    /// Apply a profile (set all environment versions)
    pub async fn apply(&self, id: &str) -> CogniaResult<ProfileApplyResult> {
        let profile = self
            .get(id)
            .ok_or_else(|| CogniaError::Provider(format!("Profile with ID {} not found", id)))?;

        let mut result = ProfileApplyResult {
            profile_id: profile.id.clone(),
            profile_name: profile.name.clone(),
            successful: Vec::new(),
            failed: Vec::new(),
            skipped: Vec::new(),
        };

        let registry = self.registry.read().await;

        for env in &profile.environments {
            // Try to find the provider
            let provider_id = env
                .provider_id
                .clone()
                .unwrap_or_else(|| self.env_type_to_default_provider(&env.env_type));

            match registry.get_environment_provider(&provider_id) {
                Some(provider) => {
                    // Check if version is installed
                    match provider.list_installed_versions().await {
                        Ok(versions) => {
                            let is_installed = versions.iter().any(|v| v.version == env.version);

                            if !is_installed {
                                result.skipped.push(ProfileEnvironmentSkipped {
                                    env_type: env.env_type.clone(),
                                    version: env.version.clone(),
                                    reason: format!("Version {} is not installed", env.version),
                                });
                                continue;
                            }

                            // Set global version
                            match provider.set_global_version(&env.version).await {
                                Ok(_) => {
                                    result.successful.push(ProfileEnvironmentResult {
                                        env_type: env.env_type.clone(),
                                        version: env.version.clone(),
                                        provider_id: provider_id.clone(),
                                    });
                                }
                                Err(e) => {
                                    result.failed.push(ProfileEnvironmentError {
                                        env_type: env.env_type.clone(),
                                        version: env.version.clone(),
                                        error: e.to_string(),
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            result.failed.push(ProfileEnvironmentError {
                                env_type: env.env_type.clone(),
                                version: env.version.clone(),
                                error: format!("Failed to list versions: {}", e),
                            });
                        }
                    }
                }
                None => {
                    result.skipped.push(ProfileEnvironmentSkipped {
                        env_type: env.env_type.clone(),
                        version: env.version.clone(),
                        reason: format!("Provider {} not available", provider_id),
                    });
                }
            }
        }

        Ok(result)
    }

    /// Export a profile to JSON
    pub fn export(&self, id: &str) -> CogniaResult<String> {
        let profile = self
            .get(id)
            .ok_or_else(|| CogniaError::Provider(format!("Profile with ID {} not found", id)))?;

        serde_json::to_string_pretty(&profile)
            .map_err(|e| CogniaError::Parse(format!("Failed to export profile: {}", e)))
    }

    /// Import a profile from JSON
    pub async fn import(&mut self, json: &str) -> CogniaResult<EnvironmentProfile> {
        let mut profile: EnvironmentProfile = serde_json::from_str(json)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse profile: {}", e)))?;

        // Generate new ID to avoid conflicts
        profile.id = Uuid::new_v4().to_string();
        profile.created_at = chrono::Utc::now().to_rfc3339();
        profile.updated_at = profile.created_at.clone();

        self.create(profile).await
    }

    /// Create a profile from current environment state
    pub async fn create_from_current(&mut self, name: &str) -> CogniaResult<EnvironmentProfile> {
        let mut profile = EnvironmentProfile::new(name);

        // Collect environment info while holding the read lock
        {
            let registry = self.registry.read().await;
            let provider_ids: Vec<String> = registry
                .list_environment_providers()
                .iter()
                .map(|s| s.to_string())
                .collect();

            for provider_id in provider_ids {
                if let Some(provider) = registry.get_environment_provider(&provider_id) {
                    if let Ok(Some(version)) = provider.get_current_version().await {
                        let env_type = self.provider_to_env_type(&provider_id);
                        profile.add_environment(ProfileEnvironment {
                            env_type,
                            version,
                            provider_id: Some(provider_id),
                        });
                    }
                }
            }
        } // registry lock is dropped here

        self.create(profile).await
    }

    /// Map environment type to default provider ID
    fn env_type_to_default_provider(&self, env_type: &str) -> String {
        match env_type.to_lowercase().as_str() {
            "node" => "fnm".to_string(),
            "deno" => "deno".to_string(),
            "python" => "pyenv".to_string(),
            "go" => "goenv".to_string(),
            "rust" => "rustup".to_string(),
            "ruby" => "rbenv".to_string(),
            "java" => "sdkman".to_string(),
            "php" => "phpbrew".to_string(),
            "dotnet" => "dotnet".to_string(),
            _ => env_type.to_string(),
        }
    }

    /// Map provider ID to environment type
    fn provider_to_env_type(&self, provider_id: &str) -> String {
        match provider_id {
            "fnm" | "nvm" => "node".to_string(),
            "deno" => "deno".to_string(),
            "pyenv" => "python".to_string(),
            "goenv" => "go".to_string(),
            "rustup" => "rust".to_string(),
            "rbenv" => "ruby".to_string(),
            "sdkman" => "java".to_string(),
            "phpbrew" => "php".to_string(),
            "dotnet" => "dotnet".to_string(),
            _ => provider_id.to_string(),
        }
    }
}

/// Shared profile manager type
pub type SharedProfileManager = Arc<RwLock<ProfileManager>>;

/// Create a shared profile manager
pub fn create_shared_profile_manager(
    storage_path: PathBuf,
    registry: Arc<RwLock<ProviderRegistry>>,
) -> SharedProfileManager {
    Arc::new(RwLock::new(ProfileManager::new(storage_path, registry)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_profile_new() {
        let profile = EnvironmentProfile::new("Test Profile");
        assert_eq!(profile.name, "Test Profile");
        assert!(!profile.id.is_empty());
        assert!(profile.description.is_none());
        assert!(profile.environments.is_empty());
        assert!(!profile.created_at.is_empty());
        assert_eq!(profile.created_at, profile.updated_at);
    }

    #[test]
    fn test_environment_profile_with_description() {
        let profile =
            EnvironmentProfile::new("Dev Profile").with_description("My dev environment");
        assert_eq!(profile.description, Some("My dev environment".to_string()));
    }

    #[test]
    fn test_environment_profile_add_environment() {
        let mut profile = EnvironmentProfile::new("Test");
        let original_updated = profile.updated_at.clone();

        // Brief sleep to ensure timestamp differs
        std::thread::sleep(std::time::Duration::from_millis(10));

        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "20.10.0".into(),
            provider_id: Some("fnm".into()),
        });

        assert_eq!(profile.environments.len(), 1);
        assert_eq!(profile.environments[0].env_type, "node");
        assert_ne!(profile.updated_at, original_updated);
    }

    #[test]
    fn test_environment_profile_add_environment_replaces_same_type() {
        let mut profile = EnvironmentProfile::new("Test");
        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "18.0.0".into(),
            provider_id: None,
        });
        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "20.0.0".into(),
            provider_id: Some("fnm".into()),
        });

        assert_eq!(profile.environments.len(), 1);
        assert_eq!(profile.environments[0].version, "20.0.0");
    }

    #[test]
    fn test_environment_profile_remove_environment() {
        let mut profile = EnvironmentProfile::new("Test");
        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "20.0.0".into(),
            provider_id: None,
        });
        profile.add_environment(ProfileEnvironment {
            env_type: "python".into(),
            version: "3.12.0".into(),
            provider_id: None,
        });

        profile.remove_environment("node");
        assert_eq!(profile.environments.len(), 1);
        assert_eq!(profile.environments[0].env_type, "python");
    }

    #[test]
    fn test_environment_profile_remove_nonexistent() {
        let mut profile = EnvironmentProfile::new("Test");
        profile.remove_environment("go");
        assert!(profile.environments.is_empty());
    }

    #[test]
    fn test_environment_profile_serde_roundtrip() {
        let mut profile =
            EnvironmentProfile::new("Serde Test").with_description("Test description");
        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "22.0.0".into(),
            provider_id: Some("volta".into()),
        });

        let json = serde_json::to_string(&profile).unwrap();
        let deser: EnvironmentProfile = serde_json::from_str(&json).unwrap();

        assert_eq!(deser.name, "Serde Test");
        assert_eq!(deser.description, Some("Test description".into()));
        assert_eq!(deser.environments.len(), 1);
        assert_eq!(deser.environments[0].env_type, "node");
        assert_eq!(deser.environments[0].provider_id, Some("volta".into()));
    }

    #[test]
    fn test_profile_environment_serde() {
        let env = ProfileEnvironment {
            env_type: "rust".into(),
            version: "1.75.0".into(),
            provider_id: Some("rustup".into()),
        };
        let json = serde_json::to_string(&env).unwrap();
        let deser: ProfileEnvironment = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.env_type, "rust");
        assert_eq!(deser.version, "1.75.0");
    }

    #[test]
    fn test_profile_apply_result_serde() {
        let result = ProfileApplyResult {
            profile_id: "test-id".into(),
            profile_name: "Test".into(),
            successful: vec![ProfileEnvironmentResult {
                env_type: "node".into(),
                version: "20.0.0".into(),
                provider_id: "fnm".into(),
            }],
            failed: vec![ProfileEnvironmentError {
                env_type: "python".into(),
                version: "3.12.0".into(),
                error: "not installed".into(),
            }],
            skipped: vec![ProfileEnvironmentSkipped {
                env_type: "go".into(),
                version: "1.22.0".into(),
                reason: "Provider not available".into(),
            }],
        };

        let json = serde_json::to_string(&result).unwrap();
        let deser: ProfileApplyResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.successful.len(), 1);
        assert_eq!(deser.failed.len(), 1);
        assert_eq!(deser.skipped.len(), 1);
    }

    fn make_test_manager() -> ProfileManager {
        let registry = ProviderRegistry::new();
        ProfileManager::new(
            PathBuf::from("/tmp/test-profiles"),
            Arc::new(RwLock::new(registry)),
        )
    }

    #[test]
    fn test_profile_manager_list_empty() {
        let manager = make_test_manager();
        assert!(manager.list().is_empty());
    }

    #[test]
    fn test_profile_manager_get_nonexistent() {
        let manager = make_test_manager();
        assert!(manager.get("nonexistent").is_none());
    }

    #[test]
    fn test_env_type_to_default_provider() {
        let manager = make_test_manager();
        assert_eq!(manager.env_type_to_default_provider("node"), "fnm");
        assert_eq!(manager.env_type_to_default_provider("python"), "pyenv");
        assert_eq!(manager.env_type_to_default_provider("go"), "goenv");
        assert_eq!(manager.env_type_to_default_provider("rust"), "rustup");
        assert_eq!(manager.env_type_to_default_provider("ruby"), "rbenv");
        assert_eq!(manager.env_type_to_default_provider("java"), "sdkman");
        assert_eq!(manager.env_type_to_default_provider("php"), "phpbrew");
        assert_eq!(manager.env_type_to_default_provider("dotnet"), "dotnet");
        assert_eq!(manager.env_type_to_default_provider("deno"), "deno");
        assert_eq!(
            manager.env_type_to_default_provider("unknown"),
            "unknown"
        );
    }

    #[test]
    fn test_provider_to_env_type() {
        let manager = make_test_manager();
        assert_eq!(manager.provider_to_env_type("fnm"), "node");
        assert_eq!(manager.provider_to_env_type("nvm"), "node");
        assert_eq!(manager.provider_to_env_type("pyenv"), "python");
        assert_eq!(manager.provider_to_env_type("goenv"), "go");
        assert_eq!(manager.provider_to_env_type("rustup"), "rust");
        assert_eq!(manager.provider_to_env_type("rbenv"), "ruby");
        assert_eq!(manager.provider_to_env_type("sdkman"), "java");
        assert_eq!(manager.provider_to_env_type("phpbrew"), "php");
        assert_eq!(manager.provider_to_env_type("dotnet"), "dotnet");
        assert_eq!(manager.provider_to_env_type("deno"), "deno");
        assert_eq!(manager.provider_to_env_type("custom"), "custom");
    }

    #[tokio::test]
    async fn test_profile_manager_create_and_get() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let profile = EnvironmentProfile::new("Test Profile");
        let id = profile.id.clone();

        let created = manager.create(profile).await.unwrap();
        assert_eq!(created.name, "Test Profile");

        let fetched = manager.get(&id);
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().name, "Test Profile");
    }

    #[tokio::test]
    async fn test_profile_manager_create_duplicate_id() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let profile = EnvironmentProfile::new("Test");
        let id = profile.id.clone();
        manager.create(profile).await.unwrap();

        let duplicate = EnvironmentProfile {
            id,
            name: "Duplicate".into(),
            description: None,
            environments: vec![],
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        let result = manager.create(duplicate).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_profile_manager_update() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let profile = EnvironmentProfile::new("Original");
        let id = profile.id.clone();
        manager.create(profile).await.unwrap();

        let mut updated_profile = manager.get(&id).unwrap();
        updated_profile.name = "Updated".into();

        let result = manager.update(updated_profile).await.unwrap();
        assert_eq!(result.name, "Updated");
        assert_eq!(manager.get(&id).unwrap().name, "Updated");
    }

    #[tokio::test]
    async fn test_profile_manager_update_nonexistent() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let profile = EnvironmentProfile::new("Ghost");
        let result = manager.update(profile).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_profile_manager_delete() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let profile = EnvironmentProfile::new("To Delete");
        let id = profile.id.clone();
        manager.create(profile).await.unwrap();

        manager.delete(&id).await.unwrap();
        assert!(manager.get(&id).is_none());
    }

    #[tokio::test]
    async fn test_profile_manager_delete_nonexistent() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let result = manager.delete("nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_profile_manager_export() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let mut profile = EnvironmentProfile::new("Export Test");
        profile.add_environment(ProfileEnvironment {
            env_type: "node".into(),
            version: "20.0.0".into(),
            provider_id: Some("fnm".into()),
        });
        let id = profile.id.clone();
        manager.create(profile).await.unwrap();

        let json = manager.export(&id).unwrap();
        let parsed: EnvironmentProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "Export Test");
        assert_eq!(parsed.environments.len(), 1);
    }

    #[tokio::test]
    async fn test_profile_manager_export_nonexistent() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let result = manager.export("nonexistent");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_profile_manager_import() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        let json = r#"{
            "id": "original-id",
            "name": "Imported Profile",
            "description": null,
            "environments": [
                {"env_type": "node", "version": "22.0.0", "provider_id": null}
            ],
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }"#;

        let imported = manager.import(json).await.unwrap();
        assert_eq!(imported.name, "Imported Profile");
        // ID should be regenerated
        assert_ne!(imported.id, "original-id");
        assert_eq!(imported.environments.len(), 1);
    }

    #[tokio::test]
    async fn test_profile_manager_list() {
        let registry = ProviderRegistry::new();
        let dir = tempfile::tempdir().unwrap();
        let mut manager = ProfileManager::new(
            dir.path().to_path_buf(),
            Arc::new(RwLock::new(registry)),
        );

        manager
            .create(EnvironmentProfile::new("Profile 1"))
            .await
            .unwrap();
        manager
            .create(EnvironmentProfile::new("Profile 2"))
            .await
            .unwrap();

        let profiles = manager.list();
        assert_eq!(profiles.len(), 2);
    }

    #[tokio::test]
    async fn test_profile_manager_save_and_load() {
        let registry = Arc::new(RwLock::new(ProviderRegistry::new()));
        let dir = tempfile::tempdir().unwrap();

        let profile_id;
        {
            let mut manager =
                ProfileManager::new(dir.path().to_path_buf(), registry.clone());
            let profile = EnvironmentProfile::new("Persist Test");
            profile_id = profile.id.clone();
            manager.create(profile).await.unwrap();
        }

        {
            let mut manager =
                ProfileManager::new(dir.path().to_path_buf(), registry.clone());
            manager.load().await.unwrap();
            let loaded = manager.get(&profile_id);
            assert!(loaded.is_some());
            assert_eq!(loaded.unwrap().name, "Persist Test");
        }
    }
}
