const webpush = require('web-push');
const fs      = require('fs');
const path    = require('path');


const VAPID_PUBLIC_KEY  = 'BC55qvmm8kBX8uwExyQZJRTdpX_tH29yhdun4nJ9jMKoK74QtdyZjlWIgSTe-Dwz3S6RLHgP7HfeO73KaTMY3Mw';
const VAPID_PRIVATE_KEY = 'KYcJGVkYqKYKQAwAmhTM1Md0iaQtRnWAhAkYFvHKty0';

webpush.setVapidDetails(
  'mailto:admin@ht.local',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const SUBS_FILE    = path.join(__dirname, 'subscriptions.json');
const DATA_FILE    = path.join(__dirname, 'data.json');
const PROFILES_DIR = path.join(__dirname, '..', '..', 'profiles');

function loadSubs() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); }
  catch { return []; }
}

function saveSubs(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

const purple = s => `\x1b[35m${s}\x1b[0m`;

module.exports = function(app) {

  app.get('/api/vapid-public-key', (req, res) => {
    res.json({ key: VAPID_PUBLIC_KEY });
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const { token1, idtoken, idchannel, invisible } = req.body;

      if (!token1 || !token1.trim()) {
        return res.status(400).json({
          ok: false,
          message: 'Thiếu token1 — cần token Discord để lấy tên người dùng'
        });
      }

      let discordName;
      try {
        const discordRes = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: token1.trim() }
        });

        if (!discordRes.ok) {
          const errBody = await discordRes.json().catch(() => ({}));
          return res.status(401).json({
            ok: false,
            message: `Discord từ chối token: ${errBody.message || discordRes.status}`
          });
        }

        const discordUser = await discordRes.json();
        discordName = discordUser.global_name || discordUser.username;

      } catch (fetchErr) {
        return res.status(502).json({
          ok: false,
          message: `Không kết nối được Discord API: ${fetchErr.message}`
        });
      }

      const safeName = discordName
        .trim()
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF ]/g, '')
        .trim()
        .replace(/\s+/g, '_');

      if (!safeName) {
        return res.status(400).json({
          ok: false,
          message: `Tên Discord "${discordName}" không hợp lệ sau khi sanitize`
        });
      }

      const profileDir = path.join(PROFILES_DIR, safeName);
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      const data = {
        token1:      token1      || '',
        idtoken:     idtoken     || '',
        idchannel:   idchannel   || '',
        invisible:   invisible   || false,
        displayName: safeName,
        updatedAt:   new Date().toISOString()
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

      const envContent =
`TOKEN=${token1 || ''}
ID_USER=${idtoken || ''}
CHANNEL=${idchannel || ''}
INV=${invisible || false}
`;
      fs.writeFileSync(path.join(profileDir, '.env'), envContent);

      console.log(purple(`👤 Discord name: ${discordName} → folder: ${safeName}`));

      res.json({
        ok:          true,
        message:     'Đồng bộ thành công',
        profile:     safeName,
        discordName,
        envPath:     `profiles/${safeName}/.env`
      });

    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get('/api/profiles', (req, res) => {
    try {
      if (!fs.existsSync(PROFILES_DIR)) return res.json({ ok: true, profiles: [] });

      const profiles = fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => ({
          name:   d.name,
          hasEnv: fs.existsSync(path.join(PROFILES_DIR, d.name, '.env'))
        }));

      res.json({ ok: true, profiles });
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/subscribe', (req, res) => {
    const subs   = loadSubs();
    const exists = subs.find(s => s.endpoint === req.body.endpoint);
    if (!exists) {
      subs.push(req.body);
      saveSubs(subs);
    }
    res.json({ ok: true });
  });

  app.post('/api/notify', async (req, res) => {
    const { title = 'Thong bao', body = 'Co cap nhat moi!', url = '/' } = req.body;
    const subs    = loadSubs();
    const payload = JSON.stringify({ title, body, url });

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(sub, payload))
    );

    const valid = subs.filter((_, i) => results[i].status === 'fulfilled');
    if (valid.length !== subs.length) saveSubs(valid);

    res.json({ sent: valid.length, failed: subs.length - valid.length });
  });

};

module.exports.notify = async function(title, body, url = '/') {
  const subs    = loadSubs();
  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, payload))
  );

  const valid = subs.filter((_, i) => results[i].status === 'fulfilled');
  if (valid.length !== subs.length) saveSubs(valid);
};