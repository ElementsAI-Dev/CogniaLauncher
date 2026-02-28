use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Process failed to start: {0}")]
    StartFailed(#[from] std::io::Error),
    #[error("Process timed out after {0:?}")]
    Timeout(Duration),
    #[error("Process exited with code {0}")]
    ExitCode(i32),
    #[error("Process terminated by signal")]
    Signal,
}

pub type ProcessResult<T> = Result<T, ProcessError>;

#[derive(Debug, Clone)]
pub struct ProcessOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

#[derive(Debug, Clone)]
pub struct ProcessOptions {
    pub cwd: Option<String>,
    pub env: HashMap<String, String>,
    pub timeout: Option<Duration>,
    pub capture_output: bool,
}

impl Default for ProcessOptions {
    fn default() -> Self {
        Self {
            cwd: None,
            env: HashMap::new(),
            timeout: None,
            capture_output: true,
        }
    }
}

impl ProcessOptions {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_cwd(mut self, cwd: impl Into<String>) -> Self {
        self.cwd = Some(cwd.into());
        self
    }

    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn with_capture(mut self, capture: bool) -> Self {
        self.capture_output = capture;
        self
    }
}

pub async fn execute(
    program: &str,
    args: &[&str],
    options: Option<ProcessOptions>,
) -> ProcessResult<ProcessOutput> {
    let options = options.unwrap_or_default();

    let mut cmd = Command::new(program);
    cmd.args(args);

    if let Some(cwd) = &options.cwd {
        cmd.current_dir(cwd);
    }

    for (key, value) in &options.env {
        cmd.env(key, value);
    }

    if options.capture_output {
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
    }

    // Prevent console window from flashing on Windows when spawning console apps from GUI
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn()?;

    let output = if let Some(timeout) = options.timeout {
        match tokio::time::timeout(timeout, child.wait_with_output()).await {
            Ok(result) => result?,
            Err(_) => return Err(ProcessError::Timeout(timeout)),
        }
    } else {
        child.wait_with_output().await?
    };

    let exit_code = output.status.code().unwrap_or(-1);
    let success = output.status.success();

    Ok(ProcessOutput {
        exit_code,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success,
    })
}

pub async fn execute_shell(
    command: &str,
    options: Option<ProcessOptions>,
) -> ProcessResult<ProcessOutput> {
    #[cfg(windows)]
    let (shell, flag) = ("cmd", "/C");

    #[cfg(not(windows))]
    let (shell, flag) = ("sh", "-c");

    execute(shell, &[flag, command], options).await
}

pub async fn execute_with_streaming<F, G>(
    program: &str,
    args: &[&str],
    options: Option<ProcessOptions>,
    mut on_stdout: F,
    mut on_stderr: G,
) -> ProcessResult<ProcessOutput>
where
    F: FnMut(&str),
    G: FnMut(&str),
{
    let options = options.unwrap_or_default();

    let mut cmd = Command::new(program);
    cmd.args(args);

    if let Some(cwd) = &options.cwd {
        cmd.current_dir(cwd);
    }

    for (key, value) in &options.env {
        cmd.env(key, value);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()?;

    let stdout = child.stdout.take().expect("stdout not captured");
    let stderr = child.stderr.take().expect("stderr not captured");

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut stdout_output = String::new();
    let mut stderr_output = String::new();

    loop {
        tokio::select! {
            line = stdout_reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        on_stdout(&line);
                        stdout_output.push_str(&line);
                        stdout_output.push('\n');
                    }
                    Ok(None) => break,
                    Err(e) => return Err(ProcessError::StartFailed(e)),
                }
            }
            line = stderr_reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        on_stderr(&line);
                        stderr_output.push_str(&line);
                        stderr_output.push('\n');
                    }
                    Ok(None) => {}
                    Err(e) => return Err(ProcessError::StartFailed(e)),
                }
            }
        }
    }

    let status = child.wait().await?;
    let exit_code = status.code().unwrap_or(-1);

    Ok(ProcessOutput {
        exit_code,
        stdout: stdout_output,
        stderr: stderr_output,
        success: status.success(),
    })
}

/// Like `execute_with_streaming` but accepts a cancel signal.
/// When `cancel_rx` receives `true`, the child process is killed and an error is returned.
pub async fn execute_with_streaming_cancellable<F, G>(
    program: &str,
    args: &[&str],
    options: Option<ProcessOptions>,
    mut on_stdout: F,
    mut on_stderr: G,
    mut cancel_rx: tokio::sync::watch::Receiver<bool>,
) -> ProcessResult<ProcessOutput>
where
    F: FnMut(&str),
    G: FnMut(&str),
{
    let options = options.unwrap_or_default();

    let mut cmd = Command::new(program);
    cmd.args(args);

    if let Some(cwd) = &options.cwd {
        cmd.current_dir(cwd);
    }

    for (key, value) in &options.env {
        cmd.env(key, value);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()?;

    let stdout = child.stdout.take().expect("stdout not captured");
    let stderr = child.stderr.take().expect("stderr not captured");

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut stdout_output = String::new();
    let mut stderr_output = String::new();

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    let _ = child.kill().await;
                    return Err(ProcessError::Signal);
                }
            }
            line = stdout_reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        on_stdout(&line);
                        stdout_output.push_str(&line);
                        stdout_output.push('\n');
                    }
                    Ok(None) => break,
                    Err(e) => return Err(ProcessError::StartFailed(e)),
                }
            }
            line = stderr_reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        on_stderr(&line);
                        stderr_output.push_str(&line);
                        stderr_output.push('\n');
                    }
                    Ok(None) => {}
                    Err(e) => return Err(ProcessError::StartFailed(e)),
                }
            }
        }
    }

    let status = child.wait().await?;
    let exit_code = status.code().unwrap_or(-1);

    Ok(ProcessOutput {
        exit_code,
        stdout: stdout_output,
        stderr: stderr_output,
        success: status.success(),
    })
}

pub async fn which(program: &str) -> Option<String> {
    #[cfg(windows)]
    let result = execute("where", &[program], None).await;

    #[cfg(not(windows))]
    let result = execute("which", &[program], None).await;

    result.ok().and_then(|output| {
        if output.success {
            output.stdout.lines().next().map(|s| s.trim().to_string())
        } else {
            None
        }
    })
}

pub fn is_program_available(program: &str) -> bool {
    std::process::Command::new(program)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_execute_echo() {
        #[cfg(windows)]
        let output = execute("cmd", &["/C", "echo", "hello"], None)
            .await
            .unwrap();

        #[cfg(not(windows))]
        let output = execute("echo", &["hello"], None).await.unwrap();

        assert!(output.success);
        assert!(output.stdout.contains("hello"));
    }

    #[tokio::test]
    async fn test_execute_shell() {
        let output = execute_shell("echo test", None).await.unwrap();
        assert!(output.success);
        assert!(output.stdout.contains("test"));
    }

    #[tokio::test]
    async fn test_which() {
        #[cfg(windows)]
        let result = which("cmd").await;

        #[cfg(not(windows))]
        let result = which("sh").await;

        assert!(result.is_some());
    }

    #[test]
    fn test_process_options_defaults() {
        let opts = ProcessOptions::default();
        assert!(opts.cwd.is_none());
        assert!(opts.env.is_empty());
        assert!(opts.timeout.is_none());
        assert!(opts.capture_output);
    }

    #[test]
    fn test_process_options_new_equals_default() {
        let a = ProcessOptions::new();
        let b = ProcessOptions::default();
        assert_eq!(a.cwd, b.cwd);
        assert_eq!(a.env.len(), b.env.len());
        assert_eq!(a.timeout, b.timeout);
        assert_eq!(a.capture_output, b.capture_output);
    }

    #[test]
    fn test_process_options_builders() {
        let opts = ProcessOptions::new()
            .with_cwd("/tmp")
            .with_env("KEY", "VALUE")
            .with_env("KEY2", "VALUE2")
            .with_timeout(Duration::from_secs(30))
            .with_capture(false);

        assert_eq!(opts.cwd, Some("/tmp".to_string()));
        assert_eq!(opts.env.len(), 2);
        assert_eq!(opts.env.get("KEY"), Some(&"VALUE".to_string()));
        assert_eq!(opts.env.get("KEY2"), Some(&"VALUE2".to_string()));
        assert_eq!(opts.timeout, Some(Duration::from_secs(30)));
        assert!(!opts.capture_output);
    }

    #[tokio::test]
    async fn test_execute_with_env() {
        #[cfg(windows)]
        let output = execute(
            "cmd",
            &["/C", "echo", "%COGNIA_TEST_ENV%"],
            Some(ProcessOptions::new().with_env("COGNIA_TEST_ENV", "hello_env")),
        )
        .await
        .unwrap();

        #[cfg(not(windows))]
        let output = execute(
            "sh",
            &["-c", "echo $COGNIA_TEST_ENV"],
            Some(ProcessOptions::new().with_env("COGNIA_TEST_ENV", "hello_env")),
        )
        .await
        .unwrap();

        assert!(output.success);
        assert!(output.stdout.contains("hello_env"));
    }

    #[tokio::test]
    async fn test_execute_nonexistent_program() {
        let result = execute("nonexistent_program_xyz_12345", &[], None).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ProcessError::StartFailed(_)));
    }

    #[tokio::test]
    async fn test_which_nonexistent() {
        let result = which("nonexistent_program_xyz_12345").await;
        assert!(result.is_none());
    }

    #[test]
    fn test_is_program_available_true() {
        // Use programs that handle --version without blocking
        #[cfg(windows)]
        assert!(is_program_available("where"));

        #[cfg(not(windows))]
        assert!(is_program_available("ls"));
    }

    #[test]
    fn test_is_program_available_false() {
        assert!(!is_program_available("nonexistent_program_xyz_12345"));
    }

    #[tokio::test]
    async fn test_execute_exit_code() {
        #[cfg(windows)]
        let output = execute("cmd", &["/C", "exit", "42"], None).await.unwrap();

        #[cfg(not(windows))]
        let output = execute("sh", &["-c", "exit 42"], None).await.unwrap();

        assert!(!output.success);
        assert_eq!(output.exit_code, 42);
    }

    #[test]
    fn test_process_output_fields() {
        let output = ProcessOutput {
            exit_code: 0,
            stdout: "out".to_string(),
            stderr: "err".to_string(),
            success: true,
        };
        assert_eq!(output.exit_code, 0);
        assert_eq!(output.stdout, "out");
        assert_eq!(output.stderr, "err");
        assert!(output.success);
    }

    #[test]
    fn test_process_error_display() {
        let err = ProcessError::Timeout(Duration::from_secs(10));
        assert!(format!("{}", err).contains("10"));

        let err = ProcessError::ExitCode(1);
        assert!(format!("{}", err).contains("1"));

        let err = ProcessError::Signal;
        assert!(format!("{}", err).contains("signal"));
    }
}
