# Local Cybersecurity Demo

This exercise is intentionally local-only. It does not weaken the application security controls. The demo shows what an attacker can do after obtaining valid admin credentials or an active admin browser session.

## Requirements

- API running on `http://localhost:5174`
- React app running on `http://localhost:5173`
- Local development admin credentials from `server/.env`
- Node 18 or newer

Default local credentials:

```text
username: admin
password: admin
```

## Fast Path

Run the whole demo:

```bash
node scripts/security-demo.mjs
```

Then refresh:

```text
http://localhost:5173
```

Show these visible results:

- A player named `Security Demo Player`
- Bank changed to `999999`
- Leaderboard changed by repeated fabricated wins

## What The Script Demonstrates

1. Login with weak local admin credentials.
2. Reuse the authenticated session cookie.
3. Read protected player data directly from the API.
4. Use the valid CSRF token to change a player bank without using the UI.
5. Replay score submissions to inflate the leaderboard.

These actions pass because the caller is authenticated as admin. The lesson is that weak credentials and stolen sessions are high-impact even when the API has CSRF, roles, and validation.

## Live Manual Steps

Open the app:

```text
http://localhost:5173
```

Log in:

```text
username: admin
password: admin
```

Open DevTools Console and get session context:

```js
const me = await fetch('http://localhost:5174/api/auth/me', {
  credentials: 'include'
}).then((response) => response.json());

me;
```

List protected players:

```js
const players = await fetch('http://localhost:5174/api/players', {
  credentials: 'include'
}).then((response) => response.json());

players;
```

Pick a player ID and change the bank:

```js
await fetch('http://localhost:5174/api/players/1/bank', {
  method: 'PATCH',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': me.csrfToken
  },
  body: JSON.stringify({ bank: 999999 })
}).then((response) => response.json());
```

Replace `1` with a real player ID from `players`.

Replay fabricated score events:

```js
for (let index = 0; index < 5; index += 1) {
  await fetch('http://localhost:5174/api/scores', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': me.csrfToken
    },
    body: JSON.stringify({
      playerId: 1,
      result: 'win',
      amount: 1000
    })
  });
}

await fetch('http://localhost:5174/api/scores', {
  credentials: 'include'
}).then((response) => response.json());
```

Replace `1` with the same real player ID.

## Reset Demo Data

The safest reset is through the Developer panel:

1. Click `Developer`.
2. Click `Clear leaderboard` if demo scores can be removed.
3. Restore the demo player's bank with the app or SQL.

For a local PostgreSQL reset of the generated demo player:

```bash
psql postgresql://luisbatista@localhost:5432/blackjack
```

```sql
DELETE FROM scores WHERE player_name = 'Security Demo Player';
DELETE FROM players WHERE name = 'Security Demo Player';
DELETE FROM users WHERE username LIKE 'security_demo_player_%';
```

If you changed an existing player manually, restore that player's bank:

```sql
UPDATE players SET bank = 500 WHERE name = 'Player Name';
```

## Presenter Notes

Recommended order:

1. Show `admin/admin` login.
2. Explain that weak credentials are the first successful attack.
3. Run `node scripts/security-demo.mjs`.
4. Refresh the app and show bank/leaderboard impact.
5. Explain that this is session abuse, not a bypass of CSRF.
6. Reset demo data.

Keep the browser console open during the manual version so the audience can see each API call and result.
