-- Deleting tasks added by mistake.
-- A deleted task is hidden, not erased, so its reassignment history stays and the task history can show who deleted it.
ALTER TABLE tasks ADD COLUMN deleted_by_id INTEGER REFERENCES users(user_id);
ALTER TABLE tasks ADD COLUMN deleted_date TEXT;
-- A teammate asking the owner to delete their task. The owner approves (deletes it) or declines (clears the request).
ALTER TABLE tasks ADD COLUMN delete_requested_by_id INTEGER REFERENCES users(user_id);
ALTER TABLE tasks ADD COLUMN delete_requested_date TEXT;
