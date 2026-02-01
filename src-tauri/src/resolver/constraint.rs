use super::version::Version;
use crate::error::CogniaError;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VersionConstraint {
    Any,
    Exact(Version),
    GreaterThan(Version),
    GreaterThanOrEqual(Version),
    LessThan(Version),
    LessThanOrEqual(Version),
    Caret(Version),
    Tilde(Version),
    Range {
        min: Option<Version>,
        max: Option<Version>,
        min_inclusive: bool,
        max_inclusive: bool,
    },
    And(Vec<VersionConstraint>),
    Or(Vec<VersionConstraint>),
}

impl VersionConstraint {
    pub fn any() -> Self {
        Self::Any
    }
    pub fn exact(v: Version) -> Self {
        Self::Exact(v)
    }
    pub fn gte(v: Version) -> Self {
        Self::GreaterThanOrEqual(v)
    }
    pub fn gt(v: Version) -> Self {
        Self::GreaterThan(v)
    }
    pub fn lte(v: Version) -> Self {
        Self::LessThanOrEqual(v)
    }
    pub fn lt(v: Version) -> Self {
        Self::LessThan(v)
    }
    pub fn caret(v: Version) -> Self {
        Self::Caret(v)
    }
    pub fn tilde(v: Version) -> Self {
        Self::Tilde(v)
    }

    pub fn matches(&self, version: &Version) -> bool {
        match self {
            Self::Any => true,
            Self::Exact(v) => version == v,
            Self::GreaterThan(v) => version > v,
            Self::GreaterThanOrEqual(v) => version >= v,
            Self::LessThan(v) => version < v,
            Self::LessThanOrEqual(v) => version <= v,
            Self::Caret(v) => {
                if version < v {
                    return false;
                }
                if v.major == 0 {
                    if v.minor == 0 {
                        version.major == 0 && version.minor == 0 && version.patch == v.patch
                    } else {
                        version.major == 0 && version.minor == v.minor
                    }
                } else {
                    version.major == v.major
                }
            }
            Self::Tilde(v) => version >= v && version.major == v.major && version.minor == v.minor,
            Self::Range {
                min,
                max,
                min_inclusive,
                max_inclusive,
            } => {
                let min_ok = match min {
                    None => true,
                    Some(m) => {
                        if *min_inclusive {
                            version >= m
                        } else {
                            version > m
                        }
                    }
                };
                let max_ok = match max {
                    None => true,
                    Some(m) => {
                        if *max_inclusive {
                            version <= m
                        } else {
                            version < m
                        }
                    }
                };
                min_ok && max_ok
            }
            Self::And(constraints) => constraints.iter().all(|c| c.matches(version)),
            Self::Or(constraints) => constraints.iter().any(|c| c.matches(version)),
        }
    }

    pub fn is_satisfied_by(&self, versions: &[Version]) -> bool {
        versions.iter().any(|v| self.matches(v))
    }

    pub fn select_best<'a>(&self, versions: &'a [Version]) -> Option<&'a Version> {
        versions.iter().filter(|v| self.matches(v)).max()
    }
}

impl FromStr for VersionConstraint {
    type Err = CogniaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();

        if s.is_empty() || s == "*" || s == "latest" {
            return Ok(Self::Any);
        }

        if s.contains("||") {
            let parts: Result<Vec<_>, _> = s.split("||").map(|p| p.trim().parse()).collect();
            return Ok(Self::Or(parts?));
        }

        if s.contains(' ') && !s.contains("||") {
            let parts: Result<Vec<_>, _> = s
                .split_whitespace()
                .filter(|p| !p.is_empty())
                .map(|p| p.parse())
                .collect();
            return Ok(Self::And(parts?));
        }

        if let Some(rest) = s.strip_prefix("^") {
            return Ok(Self::Caret(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix("~") {
            return Ok(Self::Tilde(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix(">=") {
            return Ok(Self::GreaterThanOrEqual(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix(">") {
            return Ok(Self::GreaterThan(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix("<=") {
            return Ok(Self::LessThanOrEqual(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix("<") {
            return Ok(Self::LessThan(rest.parse()?));
        }

        if let Some(rest) = s.strip_prefix("=") {
            return Ok(Self::Exact(rest.parse()?));
        }

        if s.contains('x') || s.contains('X') || s.contains('*') {
            let parts: Vec<&str> = s.split('.').collect();
            let major = parts.first().and_then(|p| p.parse().ok()).unwrap_or(0);

            if parts.len() == 1
                || parts
                    .get(1)
                    .map(|p| *p == "x" || *p == "X" || *p == "*")
                    .unwrap_or(true)
            {
                return Ok(Self::Range {
                    min: Some(Version::new(major, 0, 0)),
                    max: Some(Version::new(major + 1, 0, 0)),
                    min_inclusive: true,
                    max_inclusive: false,
                });
            }

            let minor = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
            return Ok(Self::Range {
                min: Some(Version::new(major, minor, 0)),
                max: Some(Version::new(major, minor + 1, 0)),
                min_inclusive: true,
                max_inclusive: false,
            });
        }

        Ok(Self::Exact(s.parse()?))
    }
}

impl fmt::Display for VersionConstraint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Any => write!(f, "*"),
            Self::Exact(v) => write!(f, "={}", v),
            Self::GreaterThan(v) => write!(f, ">{}", v),
            Self::GreaterThanOrEqual(v) => write!(f, ">={}", v),
            Self::LessThan(v) => write!(f, "<{}", v),
            Self::LessThanOrEqual(v) => write!(f, "<={}", v),
            Self::Caret(v) => write!(f, "^{}", v),
            Self::Tilde(v) => write!(f, "~{}", v),
            Self::Range { min, max, .. } => {
                if let Some(m) = min {
                    write!(f, ">={}", m)?;
                }
                if min.is_some() && max.is_some() {
                    write!(f, " ")?;
                }
                if let Some(m) = max {
                    write!(f, "<{}", m)?;
                }
                Ok(())
            }
            Self::And(cs) => {
                let strs: Vec<_> = cs.iter().map(|c| c.to_string()).collect();
                write!(f, "{}", strs.join(" "))
            }
            Self::Or(cs) => {
                let strs: Vec<_> = cs.iter().map(|c| c.to_string()).collect();
                write!(f, "{}", strs.join(" || "))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        let c: VersionConstraint = "1.2.3".parse().unwrap();
        assert!(c.matches(&"1.2.3".parse().unwrap()));
        assert!(!c.matches(&"1.2.4".parse().unwrap()));
    }

    #[test]
    fn test_caret() {
        let c: VersionConstraint = "^1.2.3".parse().unwrap();
        assert!(c.matches(&"1.2.3".parse().unwrap()));
        assert!(c.matches(&"1.9.0".parse().unwrap()));
        assert!(!c.matches(&"2.0.0".parse().unwrap()));
        assert!(!c.matches(&"1.2.2".parse().unwrap()));
    }

    #[test]
    fn test_tilde() {
        let c: VersionConstraint = "~1.2.3".parse().unwrap();
        assert!(c.matches(&"1.2.3".parse().unwrap()));
        assert!(c.matches(&"1.2.9".parse().unwrap()));
        assert!(!c.matches(&"1.3.0".parse().unwrap()));
    }

    #[test]
    fn test_range() {
        let c: VersionConstraint = ">=1.0.0 <2.0.0".parse().unwrap();
        assert!(c.matches(&"1.0.0".parse().unwrap()));
        assert!(c.matches(&"1.5.0".parse().unwrap()));
        assert!(!c.matches(&"0.9.0".parse().unwrap()));
        assert!(!c.matches(&"2.0.0".parse().unwrap()));
    }

    #[test]
    fn test_wildcard() {
        let c: VersionConstraint = "1.x".parse().unwrap();
        assert!(c.matches(&"1.0.0".parse().unwrap()));
        assert!(c.matches(&"1.9.9".parse().unwrap()));
        assert!(!c.matches(&"2.0.0".parse().unwrap()));
    }
}
