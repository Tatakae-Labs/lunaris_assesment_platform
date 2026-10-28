/**
 * Lunaris Offline-First Storage & Synchronization Engine
 * Provides persistent local caching and automatic queue-draining for candidate examination answers.
 */

const STORAGE_PREFIX = "lunaris_cbt_";

export const offlineStorage = {
  /**
   * Save an answer to local persistent storage immediately.
   */
  saveAnswerLocal(sessionToken, questionId, answerObj) {
    if (!sessionToken || !questionId) return;
    try {
      const key = `${STORAGE_PREFIX}answers_${sessionToken}`;
      const existing = this.getLocalAnswers(sessionToken);
      existing[questionId] = {
        ...answerObj,
        _localTimestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(existing));

      // Also append to pending sync queue
      this.enqueuePendingSync(sessionToken, questionId, answerObj);
    } catch (e) {
      console.warn("Local storage write error:", e);
    }
  },

  /**
   * Retrieve all saved answers for a session from local storage.
   */
  getLocalAnswers(sessionToken) {
    if (!sessionToken) return {};
    try {
      const key = `${STORAGE_PREFIX}answers_${sessionToken}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Add an answer to the pending offline sync queue.
   */
  enqueuePendingSync(sessionToken, questionId, answerObj) {
    if (!sessionToken) return;
    try {
      const queueKey = `${STORAGE_PREFIX}queue_${sessionToken}`;
      const queue = this.getPendingQueue(sessionToken);
      // Remove any prior pending sync for this question to keep latest revision only
      const filtered = queue.filter(item => item.questionId !== questionId);
      filtered.push({
        questionId,
        answerObj,
        timestamp: Date.now()
      });
      localStorage.setItem(queueKey, JSON.stringify(filtered));
    } catch (e) {
      console.warn("Error enqueuing pending sync:", e);
    }
  },

  /**
   * Get list of pending sync items.
   */
  getPendingQueue(sessionToken) {
    if (!sessionToken) return [];
    try {
      const queueKey = `${STORAGE_PREFIX}queue_${sessionToken}`;
      const raw = localStorage.getItem(queueKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Remove an item from the pending sync queue after successful API dispatch.
   */
  dequeuePendingSync(sessionToken, questionId) {
    if (!sessionToken) return;
    try {
      const queueKey = `${STORAGE_PREFIX}queue_${sessionToken}`;
      const queue = this.getPendingQueue(sessionToken);
      const updated = queue.filter(item => item.questionId !== questionId);
      localStorage.setItem(queueKey, JSON.stringify(updated));
    } catch (e) {
      console.warn("Error dequeuing item:", e);
    }
  },

  /**
   * Drain the pending queue by sending all buffered answers to the server.
   */
  async flushQueue(sessionToken, sendAnswerApi) {
    if (!sessionToken || typeof sendAnswerApi !== "function") return 0;
    if (!navigator.onLine) return 0;

    const queue = this.getPendingQueue(sessionToken);
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    for (const item of queue) {
      try {
        await sendAnswerApi(sessionToken, item.questionId, item.answerObj);
        this.dequeuePendingSync(sessionToken, item.questionId);
        syncedCount++;
      } catch (err) {
        console.warn(`Failed to sync queued answer for question ${item.questionId}:`, err.message);
        break; // Stop draining on network failure; will retry later
      }
    }
    return syncedCount;
  },

  /**
   * Purge local storage entries once an examination is formally finalized and submitted.
   */
  clearSession(sessionToken) {
    if (!sessionToken) return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}answers_${sessionToken}`);
      localStorage.removeItem(`${STORAGE_PREFIX}queue_${sessionToken}`);
    } catch {}
  }
};
