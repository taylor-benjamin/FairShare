-- Task pages check whether each task has logged work, and dashboards look up a student's own tasks.
-- Without these indexes, both scan a whole table and use up D1's daily read limit.
CREATE INDEX idx_contributions_task ON contributions(task_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
