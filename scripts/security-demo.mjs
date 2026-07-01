#!/usr/bin/env node

const API_URL = process.env.API_URL || 'http://localhost:5174';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const DEMO_PLAYER_NAME = process.env.DEMO_PLAYER_NAME || 'Security Demo Player';
const DEMO_PLAYER_USERNAME = process.env.DEMO_PLAYER_USERNAME || 'security_demo_player';
const DEMO_PLAYER_PASSWORD = process.env.DEMO_PLAYER_PASSWORD || 'password1234';
const DEMO_BANK = Number(process.env.DEMO_BANK || 999999);
const REPLAY_COUNT = Number(process.env.REPLAY_COUNT || 5);
const REPLAY_AMOUNT = Number(process.env.REPLAY_AMOUNT || 1000);

let cookieHeader = '';

function rememberCookies(response) {
  const rawCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
      ? [response.headers.get('set-cookie')]
      : [];

  if (!rawCookies.length) return;

  const nextCookies = new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [part.slice(0, separator), part.slice(separator + 1)];
      })
  );

  rawCookies.forEach((cookie) => {
    const [pair] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (separator === -1) return;
    nextCookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  });

  cookieHeader = Array.from(nextCookies.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  rememberCookies(response);

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' ? data.message : data;
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${message}`);
  }

  return data;
}

async function ensureDemoPlayer(csrfToken) {
  const players = await request('/api/players');
  const existing = players.find((player) => player.name === DEMO_PLAYER_NAME);
  if (existing) return existing;

  console.log(`Creating demo player "${DEMO_PLAYER_NAME}"...`);
  return request('/api/players', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      name: DEMO_PLAYER_NAME,
      username: `${DEMO_PLAYER_USERNAME}_${Date.now()}`,
      password: DEMO_PLAYER_PASSWORD,
      bank: 500,
    }),
  });
}

async function main() {
  console.log(`Target API: ${API_URL}`);
  console.log(`Logging in as "${ADMIN_USERNAME}"...`);

  await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  const session = await request('/api/auth/me');
  if (!session.user || !session.csrfToken) {
    throw new Error('Login succeeded but the API did not return a usable session.');
  }

  console.log(`Authenticated as ${session.user.username} (${session.user.role}).`);

  const player = await ensureDemoPlayer(session.csrfToken);
  console.log(`Demo player id: ${player.id}`);

  console.log(`Attack 1: changing bank directly to ${DEMO_BANK}...`);
  const updatedPlayer = await request(`/api/players/${player.id}/bank`, {
    method: 'PATCH',
    headers: {
      'X-CSRF-Token': session.csrfToken,
    },
    body: JSON.stringify({
      bank: DEMO_BANK,
    }),
  });
  console.log(`Bank is now ${updatedPlayer.bank}.`);

  console.log(`Attack 2: replaying ${REPLAY_COUNT} fabricated score events...`);
  for (let index = 1; index <= REPLAY_COUNT; index += 1) {
    const score = await request('/api/scores', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({
        playerId: player.id,
        result: 'win',
        amount: REPLAY_AMOUNT,
      }),
    });
    console.log(`Replay ${index}/${REPLAY_COUNT}: net=${score.net}, wins=${score.wins}, rounds=${score.rounds}`);
  }

  const scores = await request('/api/scores');
  const demoScore = scores.find((score) => score.playerName === DEMO_PLAYER_NAME);

  console.log('\nDemo complete.');
  console.log(`Refresh http://localhost:5173 and show "${DEMO_PLAYER_NAME}" in the UI.`);
  if (demoScore) {
    console.log(`Leaderboard: net=${demoScore.net}, wins=${demoScore.wins}, rounds=${demoScore.rounds}`);
  }
  console.log('\nReset hint: use the Developer panel to clear demo scores, or run the SQL in SECURITY_DEMO.md.');
}

main().catch((error) => {
  console.error(`\nSecurity demo failed: ${error.message}`);
  console.error('Check that the API is running on port 5174 and that admin credentials match server/.env.');
  process.exitCode = 1;
});
