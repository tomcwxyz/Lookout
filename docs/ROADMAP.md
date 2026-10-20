# Lookout roadmap

## Alpha 0.1 (first branch)

- [x] Monorepo and core typed project snapshots
- [x] Read-only GitHub observer
- [x] Branch ageing, PR ageing and failing workflow rules
- [x] Postgres persistence with current attention state
- [x] AI brief generator (requires model and credential)
- [x] Attention inbox and per-project pages
- [x] Quick idea capture
- [x] Local MCP server (read-only context; opt-in idea capture)
- [x] Standalone polling worker
- [x] CI tests, typecheck and build workflow (verification pending)
- [ ] Live provider credentials, migrations and first observed sync
- [ ] Production deployment

## Alpha 0.2: infrastructure

- [ ] Neon inventory: projects, branches, compute status, usage
- [ ] Vercel deployments: production and previews
- [ ] Identity map across code, PRs, DB branches and deployments
- [ ] Read-only migration inventory / applied-state verification
- [ ] Configurable attention policies and snoozing

## Alpha 0.3: project memory

- [ ] Historical observation changes and event timelines
- [ ] PR/issue and repo-docs handovers with source citations
- [ ] Capture ideas and decisions through MCP
- [ ] Watch rules: daily, on change, per project
- [ ] Explicit acceptance/decline workflow for recommendations

## Alpha 0.4: open ecosystem

- [ ] Other Git hosts, including GitLab, Codeberg and Framagit
- [ ] Additional Postgres hosts and non-Postgres sources
- [ ] Docker Compose for self-hosting, with worker scheduler
- [ ] Multi-user authentication and organisations
- [ ] Local model providers and user-selected AI backends
- [ ] Signed, auditable and permissioned automations
