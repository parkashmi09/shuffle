# mainserver full DB seed

`mainserver-full.sql.gz` = `pg_dump --no-owner --no-privileges --clean --if-exists` of the `mainserver` DB
(schema + ALL data, incl. users, staff password hashes, 2FA secrets and siteconfig secrets; repo is private).
Snapshot 2026-10-28, migrations up to `159-branches.js`.

```sh
createdb -O <db_user> <db_name>
gunzip -c packages/db/seed/mainserver-full.sql.gz | psql -v ON_ERROR_STOP=1 -U <db_user> -d <db_name>
npm run db:migrate   # applies only migrations newer than the snapshot
```

Refresh: re-run the pg_dump above into this file.
