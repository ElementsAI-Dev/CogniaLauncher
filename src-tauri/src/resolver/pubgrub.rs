use super::{Version, VersionConstraint};
use crate::error::{CogniaError, CogniaResult};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    pub version: Version,
    pub dependencies: Vec<Dependency>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub name: String,
    pub constraint: VersionConstraint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub packages: HashMap<String, Version>,
}

#[derive(Debug, Clone)]
pub struct ConflictExplanation {
    pub package: String,
    pub required_by: Vec<(String, VersionConstraint)>,
    pub message: String,
}

pub struct Resolver {
    available: HashMap<String, Vec<Package>>,
    locked: HashMap<String, Version>,
}

impl Resolver {
    pub fn new() -> Self {
        Self {
            available: HashMap::new(),
            locked: HashMap::new(),
        }
    }

    pub fn add_package(&mut self, pkg: Package) {
        self.available
            .entry(pkg.name.clone())
            .or_default()
            .push(pkg);
    }

    pub fn add_packages(&mut self, packages: Vec<Package>) {
        for pkg in packages {
            self.add_package(pkg);
        }
    }

    pub fn lock_version(&mut self, name: impl Into<String>, version: Version) {
        self.locked.insert(name.into(), version);
    }

    pub fn resolve(&self, root_deps: &[Dependency]) -> CogniaResult<Resolution> {
        let mut solution: HashMap<String, Version> = HashMap::new();
        let mut pending: Vec<Dependency> = root_deps.to_vec();
        let mut visited: HashSet<String> = HashSet::new();

        while let Some(dep) = pending.pop() {
            if visited.contains(&dep.name) {
                if let Some(resolved) = solution.get(&dep.name) {
                    if !dep.constraint.matches(resolved) {
                        return Err(CogniaError::Conflict(format!(
                            "Version conflict for '{}': {} required but {} already selected",
                            dep.name, dep.constraint, resolved
                        )));
                    }
                }
                continue;
            }

            let version = self.select_version(&dep.name, &dep.constraint, &solution)?;
            solution.insert(dep.name.clone(), version.clone());
            visited.insert(dep.name.clone());

            if let Some(packages) = self.available.get(&dep.name) {
                if let Some(pkg) = packages.iter().find(|p| p.version == version) {
                    for sub_dep in &pkg.dependencies {
                        if !visited.contains(&sub_dep.name) {
                            pending.push(sub_dep.clone());
                        } else if let Some(resolved) = solution.get(&sub_dep.name) {
                            if !sub_dep.constraint.matches(resolved) {
                                return Err(CogniaError::Conflict(format!(
                                    "Version conflict for '{}': {} required but {} already selected",
                                    sub_dep.name, sub_dep.constraint, resolved
                                )));
                            }
                        }
                    }
                }
            }
        }

        Ok(Resolution { packages: solution })
    }

    fn select_version(
        &self,
        name: &str,
        constraint: &VersionConstraint,
        _current: &HashMap<String, Version>,
    ) -> CogniaResult<Version> {
        if let Some(locked) = self.locked.get(name) {
            if constraint.matches(locked) {
                return Ok(locked.clone());
            }
        }

        let packages = self
            .available
            .get(name)
            .ok_or_else(|| CogniaError::PackageNotFound(name.into()))?;

        let versions: Vec<Version> = packages.iter().map(|p| p.version.clone()).collect();

        constraint.select_best(&versions).cloned().ok_or_else(|| {
            CogniaError::VersionNotFound(format!(
                "No version of '{}' satisfies constraint {}",
                name, constraint
            ))
        })
    }
}

impl Default for Resolver {
    fn default() -> Self {
        Self::new()
    }
}

impl Resolution {
    pub fn is_empty(&self) -> bool {
        self.packages.is_empty()
    }
    pub fn len(&self) -> usize {
        self.packages.len()
    }
    pub fn get(&self, name: &str) -> Option<&Version> {
        self.packages.get(name)
    }
    pub fn iter(&self) -> impl Iterator<Item = (&String, &Version)> {
        self.packages.iter()
    }
}

pub fn explain_conflict(conflicts: &[ConflictExplanation]) -> String {
    let mut msg = String::from("Dependency resolution failed:\n\n");

    for conflict in conflicts {
        msg.push_str(&format!(
            "  Package '{}' has conflicting requirements:\n",
            conflict.package
        ));
        for (pkg, constraint) in &conflict.required_by {
            msg.push_str(&format!("    - {} requires {}\n", pkg, constraint));
        }
        msg.push_str(&format!("  {}\n\n", conflict.message));
    }

    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_pkg(name: &str, version: &str, deps: Vec<(&str, &str)>) -> Package {
        Package {
            name: name.into(),
            version: version.parse().unwrap(),
            dependencies: deps
                .into_iter()
                .map(|(n, c)| Dependency {
                    name: n.into(),
                    constraint: c.parse().unwrap(),
                })
                .collect(),
        }
    }

    #[test]
    fn test_simple_resolution() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("a", "2.0.0", vec![]));

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "^1.0.0".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();

        assert_eq!(result.get("a"), Some(&"1.0.0".parse().unwrap()));
    }

    #[test]
    fn test_transitive_deps() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![("b", "^1.0.0")]));
        resolver.add_package(make_pkg("b", "1.0.0", vec![]));
        resolver.add_package(make_pkg("b", "1.5.0", vec![]));

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "*".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();

        assert!(result.get("a").is_some());
        assert!(result.get("b").is_some());
    }

    #[test]
    fn test_locked_version() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("a", "2.0.0", vec![]));
        resolver.lock_version("a", "1.0.0".parse().unwrap());

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "*".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();

        assert_eq!(result.get("a"), Some(&"1.0.0".parse().unwrap()));
    }

    // --- Resolver basics ---

    #[test]
    fn test_resolver_default() {
        let resolver = Resolver::default();
        let result = resolver.resolve(&[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_add_packages_batch() {
        let mut resolver = Resolver::new();
        resolver.add_packages(vec![
            make_pkg("a", "1.0.0", vec![]),
            make_pkg("a", "2.0.0", vec![]),
            make_pkg("b", "1.0.0", vec![]),
        ]);

        let deps = vec![
            Dependency { name: "a".into(), constraint: "*".parse().unwrap() },
            Dependency { name: "b".into(), constraint: "*".parse().unwrap() },
        ];
        let result = resolver.resolve(&deps).unwrap();
        assert!(result.get("a").is_some());
        assert!(result.get("b").is_some());
    }

    #[test]
    fn test_empty_root_deps() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));

        let result = resolver.resolve(&[]).unwrap();
        assert!(result.is_empty());
        assert_eq!(result.len(), 0);
    }

    // --- Resolution: multiple root deps ---

    #[test]
    fn test_multiple_root_deps() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("b", "2.0.0", vec![]));

        let deps = vec![
            Dependency { name: "a".into(), constraint: "*".parse().unwrap() },
            Dependency { name: "b".into(), constraint: "*".parse().unwrap() },
        ];
        let result = resolver.resolve(&deps).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result.get("a"), Some(&"1.0.0".parse().unwrap()));
        assert_eq!(result.get("b"), Some(&"2.0.0".parse().unwrap()));
    }

    // --- Diamond dependency ---

    #[test]
    fn test_diamond_dependency() {
        // A -> B, A -> C, B -> D ^1.0, C -> D ^1.0
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![("b", "^1.0.0"), ("c", "^1.0.0")]));
        resolver.add_package(make_pkg("b", "1.0.0", vec![("d", "^1.0.0")]));
        resolver.add_package(make_pkg("c", "1.0.0", vec![("d", "^1.0.0")]));
        resolver.add_package(make_pkg("d", "1.0.0", vec![]));
        resolver.add_package(make_pkg("d", "1.5.0", vec![]));

        let deps = vec![Dependency { name: "a".into(), constraint: "*".parse().unwrap() }];
        let result = resolver.resolve(&deps).unwrap();
        assert!(result.get("a").is_some());
        assert!(result.get("b").is_some());
        assert!(result.get("c").is_some());
        assert!(result.get("d").is_some());
    }

    // --- Conflict detection ---

    #[test]
    fn test_version_conflict() {
        let mut resolver = Resolver::new();
        // a@1.0 requires b ^1.0, c@1.0 requires b ^2.0  -> conflict on b
        resolver.add_package(make_pkg("a", "1.0.0", vec![("b", "^1.0.0")]));
        resolver.add_package(make_pkg("c", "1.0.0", vec![("b", "^2.0.0")]));
        resolver.add_package(make_pkg("b", "1.0.0", vec![]));
        resolver.add_package(make_pkg("b", "2.0.0", vec![]));

        let deps = vec![
            Dependency { name: "a".into(), constraint: "*".parse().unwrap() },
            Dependency { name: "c".into(), constraint: "*".parse().unwrap() },
        ];
        let result = resolver.resolve(&deps);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("conflict") || err_msg.contains("Conflict") || err_msg.contains("b"));
    }

    #[test]
    fn test_package_not_found() {
        let resolver = Resolver::new();
        let deps = vec![Dependency {
            name: "nonexistent".into(),
            constraint: "*".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("nonexistent") || err_msg.contains("not found"));
    }

    #[test]
    fn test_no_matching_version() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "^5.0.0".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("a") || err_msg.contains("version"));
    }

    // --- Locked version edge cases ---

    #[test]
    fn test_locked_version_not_matching_constraint() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("a", "2.0.0", vec![]));
        // Lock to 1.0.0 but require ^2.0.0 -> locked doesn't match, should pick from available
        resolver.lock_version("a", "1.0.0".parse().unwrap());

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "^2.0.0".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();
        assert_eq!(result.get("a"), Some(&"2.0.0".parse().unwrap()));
    }

    #[test]
    fn test_locked_version_matches_constraint() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("a", "1.5.0", vec![]));
        resolver.add_package(make_pkg("a", "2.0.0", vec![]));
        resolver.lock_version("a", "1.0.0".parse().unwrap());

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "^1.0.0".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();
        // Should prefer locked version over newer 1.5.0
        assert_eq!(result.get("a"), Some(&"1.0.0".parse().unwrap()));
    }

    // --- Selects best (highest matching) version ---

    #[test]
    fn test_selects_highest_matching_version() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));
        resolver.add_package(make_pkg("a", "1.5.0", vec![]));
        resolver.add_package(make_pkg("a", "1.9.0", vec![]));
        resolver.add_package(make_pkg("a", "2.0.0", vec![]));

        let deps = vec![Dependency {
            name: "a".into(),
            constraint: "^1.0.0".parse().unwrap(),
        }];
        let result = resolver.resolve(&deps).unwrap();
        assert_eq!(result.get("a"), Some(&"1.9.0".parse().unwrap()));
    }

    // --- Resolution struct methods ---

    #[test]
    fn test_resolution_is_empty() {
        let r = Resolution { packages: HashMap::new() };
        assert!(r.is_empty());
        assert_eq!(r.len(), 0);
    }

    #[test]
    fn test_resolution_len() {
        let mut pkgs = HashMap::new();
        pkgs.insert("a".to_string(), "1.0.0".parse().unwrap());
        pkgs.insert("b".to_string(), "2.0.0".parse().unwrap());
        let r = Resolution { packages: pkgs };
        assert_eq!(r.len(), 2);
        assert!(!r.is_empty());
    }

    #[test]
    fn test_resolution_get_hit_and_miss() {
        let mut pkgs = HashMap::new();
        pkgs.insert("a".to_string(), "1.0.0".parse().unwrap());
        let r = Resolution { packages: pkgs };
        assert!(r.get("a").is_some());
        assert!(r.get("z").is_none());
    }

    #[test]
    fn test_resolution_iter() {
        let mut pkgs = HashMap::new();
        pkgs.insert("a".to_string(), "1.0.0".parse().unwrap());
        pkgs.insert("b".to_string(), "2.0.0".parse().unwrap());
        let r = Resolution { packages: pkgs };
        assert_eq!(r.iter().count(), 2);
    }

    // --- explain_conflict ---

    #[test]
    fn test_explain_conflict_single() {
        let conflicts = vec![ConflictExplanation {
            package: "foo".into(),
            required_by: vec![
                ("bar".into(), "^1.0.0".parse().unwrap()),
                ("baz".into(), "^2.0.0".parse().unwrap()),
            ],
            message: "No compatible version found".into(),
        }];
        let msg = explain_conflict(&conflicts);
        assert!(msg.contains("foo"));
        assert!(msg.contains("bar"));
        assert!(msg.contains("baz"));
        assert!(msg.contains("No compatible version found"));
    }

    #[test]
    fn test_explain_conflict_multiple() {
        let conflicts = vec![
            ConflictExplanation {
                package: "x".into(),
                required_by: vec![("a".into(), "^1.0.0".parse().unwrap())],
                message: "conflict 1".into(),
            },
            ConflictExplanation {
                package: "y".into(),
                required_by: vec![("b".into(), "^2.0.0".parse().unwrap())],
                message: "conflict 2".into(),
            },
        ];
        let msg = explain_conflict(&conflicts);
        assert!(msg.contains("x"));
        assert!(msg.contains("y"));
        assert!(msg.contains("conflict 1"));
        assert!(msg.contains("conflict 2"));
    }

    #[test]
    fn test_explain_conflict_empty() {
        let msg = explain_conflict(&[]);
        assert!(msg.contains("Dependency resolution failed"));
    }

    // --- Transitive dep conflict ---

    #[test]
    fn test_transitive_dep_already_resolved_compatible() {
        // root -> a, root -> b; a -> c ^1.0, b -> c ^1.0 (compatible)
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![("c", "^1.0.0")]));
        resolver.add_package(make_pkg("b", "1.0.0", vec![("c", "^1.0.0")]));
        resolver.add_package(make_pkg("c", "1.0.0", vec![]));
        resolver.add_package(make_pkg("c", "1.5.0", vec![]));

        let deps = vec![
            Dependency { name: "a".into(), constraint: "*".parse().unwrap() },
            Dependency { name: "b".into(), constraint: "*".parse().unwrap() },
        ];
        let result = resolver.resolve(&deps).unwrap();
        assert!(result.get("c").is_some());
    }

    // --- Duplicate dep in pending (visited check) ---

    #[test]
    fn test_duplicate_root_deps_same_package() {
        let mut resolver = Resolver::new();
        resolver.add_package(make_pkg("a", "1.0.0", vec![]));

        let deps = vec![
            Dependency { name: "a".into(), constraint: "^1.0.0".parse().unwrap() },
            Dependency { name: "a".into(), constraint: "^1.0.0".parse().unwrap() },
        ];
        let result = resolver.resolve(&deps).unwrap();
        assert_eq!(result.get("a"), Some(&"1.0.0".parse().unwrap()));
    }
}
