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
}
