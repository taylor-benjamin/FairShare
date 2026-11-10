-- P07 lets the instructor change the template's default student access before publishing.
-- The Milestone 2 schema stores only anonymous_evals on projects, so this nullable column holds the
-- chosen access level (NULL = use the template default). See DECISIONS.md.
ALTER TABLE projects ADD COLUMN member_access TEXT CHECK (member_access IS NULL OR member_access IN ('read', 'write'));
