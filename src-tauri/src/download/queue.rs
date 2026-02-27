//! Download queue management

use super::state::{DownloadError, DownloadState};
use super::task::DownloadTask;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

/// Statistics for the download queue
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueStats {
    pub total_tasks: usize,
    pub queued: usize,
    pub downloading: usize,
    pub paused: usize,
    pub completed: usize,
    pub failed: usize,
    pub cancelled: usize,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
}

/// Download queue for managing multiple download tasks
#[derive(Debug)]
pub struct DownloadQueue {
    /// All tasks indexed by ID
    tasks: HashMap<String, DownloadTask>,
    /// Queue of pending task IDs (sorted by priority)
    pending: VecDeque<String>,
    /// Set of currently active (downloading) task IDs
    active: Vec<String>,
    /// Maximum concurrent downloads
    max_concurrent: usize,
}

impl Default for DownloadQueue {
    fn default() -> Self {
        Self::new(4)
    }
}

impl DownloadQueue {
    /// Create a new download queue with specified max concurrent downloads
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: HashMap::new(),
            pending: VecDeque::new(),
            active: Vec::new(),
            max_concurrent: max_concurrent.max(1),
        }
    }

    /// Set the maximum number of concurrent downloads
    pub fn set_max_concurrent(&mut self, max: usize) {
        self.max_concurrent = max.max(1);
    }

    /// Get the maximum number of concurrent downloads
    pub fn max_concurrent(&self) -> usize {
        self.max_concurrent
    }

    /// Add a new task to the queue, returns the task ID
    pub fn add(&mut self, task: DownloadTask) -> String {
        let id = task.id.clone();
        let priority = task.priority;

        self.tasks.insert(id.clone(), task);

        // Insert into pending queue based on priority
        let insert_pos = self
            .pending
            .iter()
            .position(|pid| {
                self.tasks
                    .get(pid)
                    .map(|t| t.priority < priority)
                    .unwrap_or(true)
            })
            .unwrap_or(self.pending.len());

        self.pending.insert(insert_pos, id.clone());

        id
    }

    /// Get a task by ID
    pub fn get(&self, id: &str) -> Option<&DownloadTask> {
        self.tasks.get(id)
    }

    /// Get a mutable task by ID
    pub fn get_mut(&mut self, id: &str) -> Option<&mut DownloadTask> {
        self.tasks.get_mut(id)
    }

    /// Remove a task from the queue
    pub fn remove(&mut self, id: &str) -> Option<DownloadTask> {
        self.pending.retain(|pid| pid != id);
        self.active.retain(|aid| aid != id);
        self.tasks.remove(id)
    }

    /// Pause a download task
    pub fn pause(&mut self, id: &str) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        if !task.state.can_pause() {
            return Err(DownloadError::InvalidOperation {
                state: task.state.status_text().to_string(),
                operation: "pause".to_string(),
            });
        }

        task.mark_paused();

        // Move from active to pending (front)
        self.active.retain(|aid| aid != id);

        Ok(())
    }

    /// Resume a paused download task
    pub fn resume(&mut self, id: &str) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        if !task.state.can_resume() {
            return Err(DownloadError::InvalidOperation {
                state: task.state.status_text().to_string(),
                operation: "resume".to_string(),
            });
        }

        task.state = DownloadState::Queued;

        // Add to front of pending queue
        self.pending.retain(|pid| pid != id);
        self.pending.push_front(id.to_string());

        Ok(())
    }

    /// Cancel a download task
    pub fn cancel(&mut self, id: &str) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        if task.state.is_terminal() && task.state != DownloadState::Cancelled {
            return Err(DownloadError::InvalidOperation {
                state: task.state.status_text().to_string(),
                operation: "cancel".to_string(),
            });
        }

        task.mark_cancelled();

        // Remove from active and pending
        self.active.retain(|aid| aid != id);
        self.pending.retain(|pid| pid != id);

        Ok(())
    }

    /// Set priority for a task
    pub fn set_priority(&mut self, id: &str, priority: i32) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        task.priority = priority;

        // Re-sort pending queue if task is pending
        if self.pending.contains(&id.to_string()) {
            self.pending.retain(|pid| pid != id);

            let insert_pos = self
                .pending
                .iter()
                .position(|pid| {
                    self.tasks
                        .get(pid)
                        .map(|t| t.priority < priority)
                        .unwrap_or(true)
                })
                .unwrap_or(self.pending.len());

            self.pending.insert(insert_pos, id.to_string());
        }

        Ok(())
    }

    /// Get the next task to start (if slots available)
    pub fn next_pending(&mut self) -> Option<String> {
        if self.active.len() >= self.max_concurrent {
            return None;
        }

        // Find first queued task (not paused)
        let pos = self.pending.iter().position(|id| {
            self.tasks
                .get(id)
                .map(|t| t.state == DownloadState::Queued)
                .unwrap_or(false)
        })?;

        let id = self.pending.remove(pos)?;
        self.active.push(id.clone());

        if let Some(task) = self.tasks.get_mut(&id) {
            task.mark_started();
        }

        Some(id)
    }

    /// Mark a task as completed
    pub fn complete(&mut self, id: &str) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        task.mark_completed();
        self.active.retain(|aid| aid != id);

        Ok(())
    }

    /// Mark a task as failed
    pub fn fail(&mut self, id: &str, error: DownloadError) -> Result<bool, DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        self.active.retain(|aid| aid != id);

        // Check if we should retry
        if error.is_recoverable() && task.can_retry() {
            task.increment_retry();
            task.state = DownloadState::Queued;
            task.error = Some(error.to_string());

            // Add back to pending queue
            self.pending.push_front(id.to_string());

            return Ok(true); // Will retry
        }

        task.mark_failed(error);
        Ok(false) // Won't retry
    }

    /// Get all tasks
    pub fn list_all(&self) -> Vec<&DownloadTask> {
        self.tasks.values().collect()
    }

    /// Get tasks filtered by state
    pub fn list_by_state(&self, state: &DownloadState) -> Vec<&DownloadTask> {
        self.tasks
            .values()
            .filter(|t| std::mem::discriminant(&t.state) == std::mem::discriminant(state))
            .collect()
    }

    /// Get active (downloading) tasks
    pub fn list_active(&self) -> Vec<&DownloadTask> {
        self.active
            .iter()
            .filter_map(|id| self.tasks.get(id))
            .collect()
    }

    /// Get pending tasks
    pub fn list_pending(&self) -> Vec<&DownloadTask> {
        self.pending
            .iter()
            .filter_map(|id| self.tasks.get(id))
            .collect()
    }

    /// Get queue statistics
    pub fn stats(&self) -> QueueStats {
        let mut stats = QueueStats {
            total_tasks: self.tasks.len(),
            ..Default::default()
        };

        for task in self.tasks.values() {
            if let Some(total) = task.progress.total_bytes {
                stats.total_bytes += total;
            }
            stats.downloaded_bytes += task.progress.downloaded_bytes;

            match &task.state {
                DownloadState::Queued => stats.queued += 1,
                DownloadState::Downloading => stats.downloading += 1,
                DownloadState::Paused => stats.paused += 1,
                DownloadState::Completed => stats.completed += 1,
                DownloadState::Failed { .. } => stats.failed += 1,
                DownloadState::Cancelled => stats.cancelled += 1,
            }
        }

        stats
    }

    /// Check if there are available slots for new downloads
    pub fn has_available_slots(&self) -> bool {
        self.active.len() < self.max_concurrent
    }

    /// Get number of active downloads
    pub fn active_count(&self) -> usize {
        self.active.len()
    }

    /// Get number of pending downloads
    pub fn pending_count(&self) -> usize {
        self.pending
            .iter()
            .filter(|id| {
                self.tasks
                    .get(*id)
                    .map(|t| t.state == DownloadState::Queued)
                    .unwrap_or(false)
            })
            .count()
    }

    /// Clear completed and cancelled tasks
    pub fn clear_finished(&mut self) -> usize {
        let to_remove: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, t)| matches!(t.state, DownloadState::Completed | DownloadState::Cancelled))
            .map(|(id, _)| id.clone())
            .collect();

        let count = to_remove.len();
        for id in to_remove {
            self.tasks.remove(&id);
        }
        count
    }

    /// Clear all failed tasks
    pub fn clear_failed(&mut self) -> usize {
        let to_remove: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, t)| matches!(t.state, DownloadState::Failed { .. }))
            .map(|(id, _)| id.clone())
            .collect();

        let count = to_remove.len();
        for id in to_remove {
            self.tasks.remove(&id);
        }
        count
    }

    /// Force-retry a single terminal task (failed, cancelled, or completed)
    /// Resets state to Queued, clears error, resets retry count
    pub fn retry_task(&mut self, id: &str) -> Result<(), DownloadError> {
        let task = self
            .tasks
            .get_mut(id)
            .ok_or(DownloadError::TaskNotFound { id: id.to_string() })?;

        if !task.state.is_terminal() {
            return Err(DownloadError::InvalidOperation {
                state: task.state.status_text().to_string(),
                operation: "retry".to_string(),
            });
        }

        task.state = DownloadState::Queued;
        task.error = None;
        task.retries = 0;

        // Remove from any existing position, add to front of pending
        self.pending.retain(|pid| pid != id);
        self.pending.push_front(id.to_string());

        Ok(())
    }

    /// Retry all failed tasks
    pub fn retry_all_failed(&mut self) -> usize {
        let failed_ids: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, t)| {
                matches!(
                    t.state,
                    DownloadState::Failed {
                        recoverable: true,
                        ..
                    }
                )
            })
            .map(|(id, _)| id.clone())
            .collect();

        let mut count = 0;
        for id in failed_ids {
            if self.resume(&id).is_ok() {
                count += 1;
            }
        }
        count
    }

    /// Pause all active downloads
    pub fn pause_all(&mut self) -> usize {
        let active_ids = self.active.clone();
        let mut count = 0;
        for id in active_ids {
            if self.pause(&id).is_ok() {
                count += 1;
            }
        }
        count
    }

    /// Resume all paused downloads
    pub fn resume_all(&mut self) -> usize {
        let paused_ids: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, t)| t.state == DownloadState::Paused)
            .map(|(id, _)| id.clone())
            .collect();

        let mut count = 0;
        for id in paused_ids {
            if self.resume(&id).is_ok() {
                count += 1;
            }
        }
        count
    }

    /// Cancel all non-terminal tasks
    pub fn cancel_all(&mut self) -> usize {
        let to_cancel: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, t)| !t.state.is_terminal())
            .map(|(id, _)| id.clone())
            .collect();

        let mut count = 0;
        for id in to_cancel {
            if self.cancel(&id).is_ok() {
                count += 1;
            }
        }
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn create_test_task(name: &str, priority: i32) -> DownloadTask {
        let mut task = DownloadTask::new(
            format!("https://example.com/{}.zip", name),
            PathBuf::from(format!("/tmp/{}.zip", name)),
            name.to_string(),
        );
        task.priority = priority;
        task
    }

    #[test]
    fn test_queue_add_and_get() {
        let mut queue = DownloadQueue::new(2);
        let task = create_test_task("test1", 0);
        let id = task.id.clone();

        queue.add(task);

        assert!(queue.get(&id).is_some());
        assert_eq!(queue.get(&id).unwrap().name, "test1");
    }

    #[test]
    fn test_queue_priority_ordering() {
        let mut queue = DownloadQueue::new(2);

        queue.add(create_test_task("low", 0));
        queue.add(create_test_task("high", 10));
        queue.add(create_test_task("medium", 5));

        let pending: Vec<_> = queue
            .list_pending()
            .iter()
            .map(|t| t.name.as_str())
            .collect();
        assert_eq!(pending, vec!["high", "medium", "low"]);
    }

    #[test]
    fn test_queue_next_pending() {
        let mut queue = DownloadQueue::new(2);

        let task1 = create_test_task("task1", 0);
        let task2 = create_test_task("task2", 10);

        queue.add(task1);
        queue.add(task2);

        // Should get highest priority first
        let next = queue.next_pending();
        assert!(next.is_some());
        let task = queue.get(&next.unwrap()).unwrap();
        assert_eq!(task.name, "task2");
        assert_eq!(task.state, DownloadState::Downloading);
    }

    #[test]
    fn test_queue_max_concurrent() {
        let mut queue = DownloadQueue::new(1);

        queue.add(create_test_task("task1", 0));
        queue.add(create_test_task("task2", 0));

        // First should start
        assert!(queue.next_pending().is_some());
        // Second should not (max concurrent reached)
        assert!(queue.next_pending().is_none());
    }

    #[test]
    fn test_queue_pause_resume() {
        let mut queue = DownloadQueue::new(2);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        // Start the task
        queue.next_pending();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Downloading);

        // Pause
        queue.pause(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Paused);

        // Resume
        queue.resume(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
    }

    #[test]
    fn test_queue_cancel() {
        let mut queue = DownloadQueue::new(2);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        queue.cancel(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Cancelled);
    }

    #[test]
    fn test_queue_complete() {
        let mut queue = DownloadQueue::new(2);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        queue.next_pending();
        queue.complete(&id).unwrap();

        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Completed);
        assert_eq!(queue.active_count(), 0);
    }

    #[test]
    fn test_queue_fail_with_retry() {
        let mut queue = DownloadQueue::new(2);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        queue.next_pending();

        let error = DownloadError::Network {
            message: "Connection reset".into(),
        };
        let will_retry = queue.fail(&id, error).unwrap();

        assert!(will_retry);
        assert_eq!(queue.get(&id).unwrap().retries, 1);
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
    }

    #[test]
    fn test_queue_stats() {
        let mut queue = DownloadQueue::new(4);

        queue.add(create_test_task("queued", 0));
        queue.add(create_test_task("downloading", 0));

        // next_pending picks the first queued task
        let started_id = queue.next_pending().unwrap();
        assert_eq!(
            queue.get(&started_id).unwrap().state,
            DownloadState::Downloading
        );

        let stats = queue.stats();
        assert_eq!(stats.total_tasks, 2);
        assert_eq!(stats.queued, 1);
        assert_eq!(stats.downloading, 1);
    }

    #[test]
    fn test_queue_clear_finished() {
        let mut queue = DownloadQueue::new(4);

        let task1 = create_test_task("task1", 0);
        let id1 = task1.id.clone();
        queue.add(task1);
        queue.next_pending();
        queue.complete(&id1).unwrap();

        let task2 = create_test_task("task2", 0);
        let id2 = task2.id.clone();
        queue.add(task2);
        queue.cancel(&id2).unwrap();

        queue.add(create_test_task("task3", 0));

        assert_eq!(queue.stats().total_tasks, 3);

        let cleared = queue.clear_finished();
        assert_eq!(cleared, 2);
        assert_eq!(queue.stats().total_tasks, 1);
    }

    #[test]
    fn test_queue_pause_all_resume_all() {
        let mut queue = DownloadQueue::new(4);

        for i in 0..3 {
            queue.add(create_test_task(&format!("task{}", i), 0));
        }

        // Start all
        while queue.next_pending().is_some() {}

        assert_eq!(queue.active_count(), 3);

        // Pause all
        let paused = queue.pause_all();
        assert_eq!(paused, 3);
        assert_eq!(queue.active_count(), 0);
        assert_eq!(queue.stats().paused, 3);

        // Resume all
        let resumed = queue.resume_all();
        assert_eq!(resumed, 3);
        assert_eq!(queue.stats().queued, 3);
    }

    #[test]
    fn test_queue_set_priority() {
        let mut queue = DownloadQueue::new(4);

        let task_low = create_test_task("low", 0);
        let id_low = task_low.id.clone();
        queue.add(task_low);

        let task_high = create_test_task("high", 10);
        queue.add(task_high);

        // low is at the end; change its priority to be highest
        queue.set_priority(&id_low, 20).unwrap();

        // Now low should be first in pending
        let pending: Vec<_> = queue
            .list_pending()
            .iter()
            .map(|t| t.name.as_str())
            .collect();
        assert_eq!(pending[0], "low");
    }

    #[test]
    fn test_queue_set_priority_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.set_priority("nonexistent", 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_list_by_state() {
        let mut queue = DownloadQueue::new(4);

        let task1 = create_test_task("task1", 0);
        let id1 = task1.id.clone();
        queue.add(task1);

        let task2 = create_test_task("task2", 0);
        queue.add(task2);

        // Start task1 → Downloading
        queue.next_pending();

        let downloading = queue.list_by_state(&DownloadState::Downloading);
        assert_eq!(downloading.len(), 1);
        assert_eq!(downloading[0].id, id1);

        let queued = queue.list_by_state(&DownloadState::Queued);
        assert_eq!(queued.len(), 1);
    }

    #[test]
    fn test_queue_cancel_all() {
        let mut queue = DownloadQueue::new(4);

        for i in 0..4 {
            queue.add(create_test_task(&format!("task{}", i), 0));
        }

        // Start 2 tasks
        queue.next_pending();
        queue.next_pending();

        let cancelled = queue.cancel_all();
        assert_eq!(cancelled, 4);
        assert_eq!(queue.stats().cancelled, 4);
        assert_eq!(queue.active_count(), 0);
    }

    #[test]
    fn test_queue_clear_failed() {
        let mut queue = DownloadQueue::new(4);

        // Create and fail a task (non-recoverable so it stays failed)
        let task = create_test_task("fail_task", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        let err = DownloadError::ChecksumMismatch {
            expected: "abc".into(),
            actual: "def".into(),
        };
        // Fail with non-recoverable error
        queue.fail(&id, err).unwrap();

        // Add a normal queued task
        queue.add(create_test_task("good_task", 0));

        assert_eq!(queue.stats().total_tasks, 2);

        let cleared = queue.clear_failed();
        assert_eq!(cleared, 1);
        assert_eq!(queue.stats().total_tasks, 1);
    }

    #[test]
    fn test_queue_has_available_slots() {
        let mut queue = DownloadQueue::new(1);

        assert!(queue.has_available_slots());

        queue.add(create_test_task("task1", 0));
        queue.next_pending();

        assert!(!queue.has_available_slots());
    }

    #[test]
    fn test_queue_pending_count() {
        let mut queue = DownloadQueue::new(4);

        queue.add(create_test_task("task1", 0));
        queue.add(create_test_task("task2", 0));
        queue.add(create_test_task("task3", 0));

        assert_eq!(queue.pending_count(), 3);

        // Start one, pending should decrease
        queue.next_pending();
        assert_eq!(queue.pending_count(), 2);
    }

    #[test]
    fn test_queue_fail_max_retries() {
        let mut queue = DownloadQueue::new(4);

        let mut task = create_test_task("retry_task", 0);
        task.config.max_retries = 2; // Only allow 2 retries
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        let err = DownloadError::Network {
            message: "timeout".into(),
        };

        // First fail: should retry (retries=1)
        let will_retry = queue.fail(&id, err.clone()).unwrap();
        assert!(will_retry);
        assert_eq!(queue.get(&id).unwrap().retries, 1);
        queue.next_pending(); // Re-download

        // Second fail: should retry (retries=2)
        let will_retry = queue.fail(&id, err.clone()).unwrap();
        assert!(will_retry);
        assert_eq!(queue.get(&id).unwrap().retries, 2);
        queue.next_pending(); // Re-download

        // Third fail: max retries reached, should NOT retry
        let will_retry = queue.fail(&id, err).unwrap();
        assert!(!will_retry);
        assert!(queue.get(&id).unwrap().state.is_terminal());
    }

    #[test]
    fn test_queue_remove() {
        let mut queue = DownloadQueue::new(4);

        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        assert_eq!(queue.stats().total_tasks, 1);

        let removed = queue.remove(&id);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "task1");
        assert_eq!(queue.stats().total_tasks, 0);
    }

    #[test]
    fn test_queue_remove_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let removed = queue.remove("nonexistent");
        assert!(removed.is_none());
    }

    #[test]
    fn test_queue_retry_all_failed() {
        let mut queue = DownloadQueue::new(4);

        // Create task with high max_retries
        let mut task = create_test_task("fail_task", 0);
        task.config.max_retries = 0; // No retries allowed normally
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        // Fail with recoverable error
        let err = DownloadError::Network {
            message: "timeout".into(),
        };
        let _ = queue.fail(&id, err);

        // The task should now be in a failed state (no retries left)
        // retry_all_failed should re-queue recoverable failures
        let retried = queue.retry_all_failed();
        assert_eq!(retried, 1);
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
    }

    #[test]
    fn test_queue_list_active() {
        let mut queue = DownloadQueue::new(4);

        queue.add(create_test_task("task1", 0));
        queue.add(create_test_task("task2", 0));
        queue.add(create_test_task("task3", 0));

        // Start 2
        queue.next_pending();
        queue.next_pending();

        let active = queue.list_active();
        assert_eq!(active.len(), 2);
    }

    #[test]
    fn test_queue_get_mut() {
        let mut queue = DownloadQueue::new(4);

        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        // Modify via get_mut
        if let Some(t) = queue.get_mut(&id) {
            t.name = "modified".to_string();
        }

        assert_eq!(queue.get(&id).unwrap().name, "modified");
    }

    #[test]
    fn test_queue_stats_comprehensive() {
        let mut queue = DownloadQueue::new(10);

        // Add 6 tasks, each will end in a different state
        let task_q = create_test_task("queued_task", 0);
        let task_dl = create_test_task("downloading_task", 0);
        let task_p = create_test_task("paused_task", 0);
        let task_c = create_test_task("completed_task", 0);
        let task_x = create_test_task("cancelled_task", 0);
        let task_f = create_test_task("failed_task", 0);

        queue.add(task_q);
        queue.add(task_dl);
        queue.add(task_p);
        queue.add(task_c);
        queue.add(task_x);
        queue.add(task_f);

        // Start 4 tasks via next_pending (they become Downloading)
        let _id1 = queue.next_pending().unwrap();
        let id2 = queue.next_pending().unwrap();
        let id3 = queue.next_pending().unwrap();
        let id4 = queue.next_pending().unwrap();

        // Leave one downloading (id1), pause id2, complete id3, fail id4
        queue.pause(&id2).unwrap();
        queue.complete(&id3).unwrap();
        let err = DownloadError::ChecksumMismatch {
            expected: "a".into(),
            actual: "b".into(),
        };
        queue.fail(&id4, err).unwrap();

        // Cancel one of the remaining queued tasks
        let queued_tasks: Vec<String> = queue
            .list_by_state(&DownloadState::Queued)
            .iter()
            .map(|t| t.id.clone())
            .collect();
        if let Some(qid) = queued_tasks.first() {
            queue.cancel(qid).unwrap();
        }

        let stats = queue.stats();
        assert_eq!(stats.total_tasks, 6);
        assert_eq!(stats.downloading, 1);
        assert_eq!(stats.paused, 1);
        assert_eq!(stats.completed, 1);
        assert_eq!(stats.failed, 1);
        assert_eq!(stats.cancelled, 1);
        assert_eq!(stats.queued, 1);
    }

    #[test]
    fn test_queue_pause_queued_task() {
        let mut queue = DownloadQueue::new(4);

        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        // Pause a queued (not yet downloading) task
        queue.pause(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Paused);
    }

    #[test]
    fn test_queue_cancel_paused_task() {
        let mut queue = DownloadQueue::new(4);

        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        queue.pause(&id).unwrap();
        queue.cancel(&id).unwrap();

        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Cancelled);
    }

    #[test]
    fn test_queue_retry_task_failed_recoverable() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        let err = DownloadError::Network {
            message: "timeout".into(),
        };
        // Exhaust retries so it stays failed
        queue.get_mut(&id).unwrap().config.max_retries = 0;
        queue.fail(&id, err).unwrap();
        assert!(queue.get(&id).unwrap().state.is_terminal());

        // Force retry should work
        queue.retry_task(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
        assert_eq!(queue.get(&id).unwrap().retries, 0);
        assert!(queue.get(&id).unwrap().error.is_none());
    }

    #[test]
    fn test_queue_retry_task_failed_non_recoverable() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        let err = DownloadError::ChecksumMismatch {
            expected: "abc".into(),
            actual: "def".into(),
        };
        queue.fail(&id, err).unwrap();
        assert!(queue.get(&id).unwrap().state.is_terminal());

        // Force retry should work even for non-recoverable
        queue.retry_task(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
        assert_eq!(queue.get(&id).unwrap().retries, 0);
    }

    #[test]
    fn test_queue_retry_task_cancelled() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.cancel(&id).unwrap();

        queue.retry_task(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
    }

    #[test]
    fn test_queue_retry_task_active_fails() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();

        // Retry an active (downloading) task should fail
        let result = queue.retry_task(&id);
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_retry_task_completed() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();
        queue.complete(&id).unwrap();

        // Retry a completed task should work (force-retry)
        queue.retry_task(&id).unwrap();
        assert_eq!(queue.get(&id).unwrap().state, DownloadState::Queued);
    }

    #[test]
    fn test_queue_retry_task_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.retry_task("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_default() {
        let queue = DownloadQueue::default();
        assert_eq!(queue.max_concurrent(), 4);
        assert_eq!(queue.stats().total_tasks, 0);
        assert!(queue.has_available_slots());
    }

    #[test]
    fn test_queue_set_max_concurrent_zero_clamps() {
        let mut queue = DownloadQueue::new(4);
        queue.set_max_concurrent(0);
        // Should clamp to 1
        assert_eq!(queue.max_concurrent(), 1);
    }

    #[test]
    fn test_queue_list_all_empty() {
        let queue = DownloadQueue::new(4);
        assert!(queue.list_all().is_empty());
        assert!(queue.list_active().is_empty());
        assert!(queue.list_pending().is_empty());
    }

    #[test]
    fn test_queue_fail_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.fail(
            "nonexistent",
            DownloadError::Network {
                message: "test".into(),
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_complete_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.complete("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_pause_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.pause("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_resume_nonexistent() {
        let mut queue = DownloadQueue::new(4);
        let result = queue.resume("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_cancel_completed_fails() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);
        queue.next_pending();
        queue.complete(&id).unwrap();

        // Cancel a completed task should fail
        let result = queue.cancel(&id);
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_resume_queued_fails() {
        let mut queue = DownloadQueue::new(4);
        let task = create_test_task("task1", 0);
        let id = task.id.clone();
        queue.add(task);

        // Resume a queued (not paused) task should fail
        let result = queue.resume(&id);
        assert!(result.is_err());
    }

    #[test]
    fn test_queue_stats_bytes_tracking() {
        let mut queue = DownloadQueue::new(4);

        let mut task1 = create_test_task("task1", 0);
        task1.progress.total_bytes = Some(1000);
        task1.progress.downloaded_bytes = 500;
        let id1 = task1.id.clone();
        queue.add(task1);

        let mut task2 = create_test_task("task2", 0);
        task2.progress.total_bytes = Some(2000);
        task2.progress.downloaded_bytes = 1000;
        queue.add(task2);

        let stats = queue.stats();
        assert_eq!(stats.total_bytes, 3000);
        assert_eq!(stats.downloaded_bytes, 1500);

        // Task without total_bytes should not contribute to total_bytes
        let mut task3 = create_test_task("task3", 0);
        task3.progress.total_bytes = None;
        task3.progress.downloaded_bytes = 200;
        queue.add(task3);

        let stats = queue.stats();
        assert_eq!(stats.total_bytes, 3000); // Unchanged
        assert_eq!(stats.downloaded_bytes, 1700); // 1500 + 200

        let _ = id1;
    }
}
