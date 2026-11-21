# OPS53 report: every runner of one repository gets the same Postgres rights

Branch OPS53-postgres-rights, from CRSP208-release-48.

Done:
- runners R5.94: shared owner role `crsp_<owner>_<repo>_owner` (NOLOGIN, CREATEROLE, CREATEDB with db_createdb); logins join WITH INHERIT TRUE, SET TRUE; databases owned by the role; db.env adds `PGOPTIONS=-c role=<role>`; removing the last login drops the role and its databases.
- doctor R5.50: `runner.postgres_logins` warns on a login no runner uses; never removes. `Postgres.Logins` and `RemoveLogin` exist.
- Specs, change notes, tests with fakes (no database).

Not done (named in the specs): agent link feeding `Env.Postgres`, the remove route, console button. Not run against a real PostgreSQL 16 (GRANT ... WITH INHERIT/SET syntax). Open question 65 in runners spec.
