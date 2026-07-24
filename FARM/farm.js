const fs = require('fs');
const path = require('path');
const startCaptchaDetector = require('../untils/captcha');
const startStatsCommand = require('../untils/webhock');
const startRPC = require('../untils/rpc');
const startGemWatcher = require('./inv');
const startDailyTimer = require('../untils/daily');
const startBlackjack = require('../gamble/blackjack');
const startHuntbot = require('../huntbot/huntbot');



const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min) + min);
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const timestamp = () => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

module.exports = async function farm(client, channelId, state) {
  const channel = client.channels.cache.get(channelId);

  if (!channel) {
    
    return;
  }

  const tag = channel.name;
  const stats = { hunt: 0, battle: 0 };

  const global = state;
  if (global.paused      === undefined) global.paused      = false;
  if (global.captcha     === undefined) global.captcha     = false;
  if (global.gemChecking === undefined) global.gemChecking = false;
  if (global.hunt        === undefined) global.hunt        = false;
  if (global.battle      === undefined) global.battle      = false;

  // ─── Client Health Check ──────────────────────────────────────
  function isClientAlive() {
    return client?.ws?.status === 0; // 0 = READY
  }

  // ─── Auto Pause ───────────────────────────────────────────────
  function startAutoPause() {
    const runTime   = randomDelay(15 * 60 * 1000, 30 * 60 * 1000);
    const pauseTime = randomDelay( 5 * 60 * 1000,  7 * 60 * 1000);

    console.log(`[${tag}]  pause  ${(runTime / 60000).toFixed(1)} phút`);

    setTimeout(() => {
      global.paused = true;
      console.log(`[${tag}] Auto pause  ${(pauseTime / 60000).toFixed(1)} phút`);

      setTimeout(() => {
        if (!global.captcha && !global.gemChecking) {
          global.paused = false;
          console.log(`[${tag}] Auto resume `);
        } else {
          console.log(`[${tag}]  Resume  hold — captcha/gem active`);
        }
        startAutoPause();
      }, pauseTime);
    }, runTime);
  }

  // ─── Blocked Check ────────────────────────────────────────────
  function isBlocked() {
    return global.paused || global.captcha || global.gemChecking;
  }

  // ─── Hunt ─────────────────────────────────────────────────────
  async function hunt() {
    const interval    = randomDelay(15000, 25000);
    const scheduledAt = Date.now();

    if (!isClientAlive() || isBlocked() || global.battle) {
      console.log(`[${tag}] Hunt skip`);
      setTimeout(hunt, interval);
      return;
    }

    global.hunt = true;
    try {
      await channel.sendTyping();

      if (isBlocked() || global.battle) {
        console.log(`[${tag}]  Hunt abort`);
        return;
      }

      await channel.send(
        `${randomChoice(["owo", "owo"])} ${randomChoice(["h", "hunt"])}`
      );
      stats.hunt++;
      console.log(`[${tag}]  Hunt #${stats.hunt} — ${timestamp()}`);

      if (stats.hunt % 3 === 0) {
        notify(
          ` Farm ${tag} — ${stats.hunt} hunt`,
          `Đã farm được ${stats.hunt} lần hunt!`,
          '/'
        ).catch(() => {});
      }

      sendPhrase();
    } catch (err) {
   
    } finally {
      global.hunt = false;
      const elapsed = Date.now() - scheduledAt;
      const next    = Math.max(0, interval - elapsed);
      console.log(`[${tag}] hunt ${(next / 1000).toFixed(1)}s`);
      setTimeout(hunt, next);
    }
  }

  // ─── Battle ───────────────────────────────────────────────────
  async function battle() {
    const interval    = randomDelay(15000, 25000);
    const scheduledAt = Date.now();

    if (!isClientAlive() || isBlocked() || global.hunt) {
      console.log(`[${tag}] Battle skip`);
      setTimeout(battle, interval);
      return;
    }

    global.battle = true;
    try {
      await channel.sendTyping();

      if (isBlocked() || global.hunt) {
        console.log(`[${tag}] Battle abort`);
        return;
      }

      await channel.send(
        `${randomChoice(["owo", "owo"])} ${randomChoice(["b", "battle"])}`
      );
      stats.battle++; 
      console.log(`[${tag}]  Battle #${stats.battle} — ${timestamp()}`);

      if (stats.battle % 3 === 0) {
        notify(
          ` Farm ${tag} — ${stats.battle} battle`,
          `Đã farm được ${stats.battle} lần battle!`,
          '/'
        ).catch(() => {});
      }
    } catch (err) {
      
    } finally {
      global.battle = false;
      const elapsed = Date.now() - scheduledAt;
      const next    = Math.max(0, interval - elapsed);
      console.log(`[${tag}] battle ${(next / 1000).toFixed(1)}s`);
      setTimeout(battle, next);
    }
  }

  // ─── Phrase ───────────────────────────────────────────────────
  async function sendPhrase() {
    if (!isClientAlive() || global.paused || global.captcha) {
      console.log(`[${tag}] Phrase skip `);
      return;
    }

    try {
      const data = fs.readFileSync(
        path.join(__dirname, '../textmess/text.json'), 'utf8'
      );
      const { phrases } = JSON.parse(data);

      if (!phrases?.length) {
        
        return;
      }

      const phrase = randomChoice(phrases);
      await channel.sendTyping();
      await delay(randomDelay(800, 1500));

      if (!isClientAlive() || global.paused || global.captcha) {
        console.log(`[${tag}] Phrase skip `);
        return;
      }

      await channel.send(phrase);
      console.log(`[${tag}]  Phrase: "${phrase}" — ${timestamp()}`);
    } catch (err) {
      
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────
  console.log(`[${tag}] Farm start : ${channel.name}`);

  startCaptchaDetector(client, channelId, client.user.id, global);
  startAutoPause();
 
  startGemWatcher(client, channelId, global);
  startStatsCommand(client, stats);
  startRPC(client);
 new startDailyTimer(client, channelId);
  startBlackjack(client, channel, global);
startHuntbot(client, channelId, global);
  hunt();
  await delay(2000);
  battle();
};