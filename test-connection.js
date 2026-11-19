// Test FileMaker Data API connectivity using .env configuration.
// Never prints passwords or session tokens.
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env'), quiet: true });

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.FM_SSL_VERIFY === 'true' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1'
});

const identifiers = Object.keys(process.env)
  .filter(k => k.startsWith('FM_SERVER_'))
  .map(k => k.replace('FM_SERVER_', ''));

if (identifiers.length === 0) {
  console.log('No FM_SERVER_* variables found in .env');
  process.exit(1);
}

let failures = 0;

for (const id of identifiers) {
  const server = process.env[`FM_SERVER_${id}`];
  const database = process.env[`FM_DATABASE_${id}`];
  const username = process.env[`FM_ACCOUNT_${id}`];
  const password = process.env[`FM_PASSWORD_${id}`];
  const protocol = process.env.FM_PROTOCOL || 'https';
  const apiVersion = process.env.FM_API_VERSION || 'v1';

  const label = `${id} (${protocol}://${server} → ${database})`;

  if ([server, database, username, password].some(v => !v || v.startsWith('YOUR_'))) {
    console.log(`⏭  ${label}: placeholders not filled in — skipping`);
    failures++;
    continue;
  }

  const baseURL = `${protocol}://${server}/fmi/data/${apiVersion}/databases/${encodeURIComponent(database)}`;
  let token;

  try {
    const auth = await axios.post(`${baseURL}/sessions`, {}, {
      auth: { username, password },
      httpsAgent,
      timeout: 15000
    });
    token = auth.data.response.token;
    console.log(`✅ ${label}: authentication OK`);
  } catch (err) {
    const msg = err.response?.data?.messages?.[0]?.message || err.message;
    console.log(`❌ ${label}: auth failed — ${msg}`);
    failures++;
    continue;
  }

  try {
    const layouts = await axios.get(`${baseURL}/layouts`, {
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent,
      timeout: 15000
    });
    const count = layouts.data.response?.layouts?.length ?? '?';
    console.log(`   layouts visible to this account: ${count}`);
  } catch (err) {
    const msg = err.response?.data?.messages?.[0]?.message || err.message;
    console.log(`⚠️  ${label}: auth OK but /layouts failed — ${msg}`);
  }

  // Clean up the session
  try {
    await axios.delete(`${baseURL}/sessions/${token}`, { httpsAgent, timeout: 10000 });
  } catch { /* ignore */ }
}

process.exit(failures > 0 ? 1 : 0);
