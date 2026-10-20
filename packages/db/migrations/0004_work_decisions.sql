CREATE TABLE IF NOT EXISTS work_decisions (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_key text NOT NULL,
  status text NOT NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_decision_project_key_uq ON work_decisions(project_id, work_key);
