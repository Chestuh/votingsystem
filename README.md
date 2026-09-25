# Voiceboard live voting system

## Run locally

Open PowerShell in this folder and configure the administrator credentials before starting the server:

```powershell
$env:VOICEBOARD_ADMIN_USER = "admin"
$env:VOICEBOARD_ADMIN_PASSWORD = "replace-with-a-strong-password"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\server.ps1
```

Then open:

- Public poll: `http://localhost:8080/`
- Admin workspace: `http://localhost:8080/admin.html`

If no password is configured, the server generates a temporary password and prints it to the terminal.

## Storage and behavior

- Candidates and vote totals are persisted in `data/ballot.json`.
- The public page refreshes the live tally every five seconds.
- Admin candidate changes are protected by a session cookie.
- Each account can vote once in every available position; duplicate votes for the same position are rejected.
- Admins can open the voter list to see each unique IGN#TAG, the number of positions they voted in, and delete a voter.

For public deployment, put the server behind HTTPS and a reverse proxy, set a permanent strong admin password through the environment, and pair this account-based limit with real voter authentication for stronger one-person-one-vote enforcement.

## Deploy on Vercel

Vercel runs the API routes in `api/` and serves the frontend from the project root.

1. Push this folder to GitHub and import the repository into Vercel.
2. Add an Upstash Redis integration to the Vercel project. It provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Add these Vercel environment variables:
	- `VOICEBOARD_ADMIN_USER`
	- `VOICEBOARD_ADMIN_PASSWORD`
	- `VOICEBOARD_SESSION_SECRET`
4. Redeploy the project.

The API stores candidates and votes in Redis. The first request creates the initial ballot. The public site uses the Vercel routes under `/api/*`.
