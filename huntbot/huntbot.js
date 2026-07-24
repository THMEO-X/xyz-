// huntbot.js
const config = require('./config');
const solveHuntbotCaptcha = require('./huntbot_captcha/huntbotcaptcha');
const startCaptchaDetector = require('../untils/captcha');

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = async function startHuntbot(client, channelId, state) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const tag = channel.name;
  const idUser = config.idUser ?? client.user?.id;
  const hbState = {
    essence: false,
    maxtime: config.huntbot.maxtime,
    recalltime: 0,
  };

  startCaptchaDetector(client, channelId, idUser, state);

  client.on('captchaResolved', () => {
    if (state.captcha) {
      state.captcha = false;
      state.paused  = false;
    }
  });

  await huntbotHandler();

  async function waitWhileBlocked() {
    while (state.paused || state.captcha) await delay(3000);
  }

  function waitForMessage(filter, timeout = 12000) {
    return new Promise((resolve) => {
      const listener = (msg) => {
        if (filter(msg)) {
          clearTimeout(timer);
          client.off('messageCreate', listener);
          resolve(msg);
        }
      };
      const timer = setTimeout(() => {
        client.off('messageCreate', listener);
        resolve(null);
      }, timeout);
      client.on('messageCreate', listener);
    });
  }

  function parseDuration(text) {
    const regex = /(\d+)([SMHD])/g;
    let ms = 0;
    for (const match of text.matchAll(regex)) {
      const n = parseInt(match[1]);
      switch (match[2]) {
        case 'S': ms += n * 1000; break;
        case 'M': ms += n * 60 * 1000; break;
        case 'H': ms += n * 60 * 60 * 1000; break;
        case 'D': ms += n * 24 * 60 * 60 * 1000; break;
      }
    }
    return ms;
  }

  async function huntbotHandler() {
    await waitWhileBlocked();
    console.log(`[${tag}] hb check`);

    const sentMsg = await channel.send(
      `${randomChoice(['owo', 'owo'])} ${randomChoice(['huntbot', 'hb'])}`
    );

    const message = await waitForMessage(
      (msg) =>
        (msg.content.includes('BEEP BOOP. I AM BACK WITH') ||
          msg.embeds[0]?.author?.name?.includes('HuntBot')) &&
        msg.author.id === '408785106942164992' &&
        msg.channel.id === channel.id &&
        msg.id > sentMsg.id,
      12000
    );

    if (!message) {
      await waitWhileBlocked();
      console.log(`[${tag}] hb no reply, retry 61s`);
      await delay(61000);
      return huntbotHandler();
    }

    if (!message.embeds[0]) {
      hbState.essence = true;
      hbState.maxtime = config.huntbot.maxtime;
      await delay(6100);
      return triggerHB();
    }

    let isHunting = false;

    for (const field of message.embeds[0].fields) {
      if (field.name.includes('is currently hunting')) {
        const ms = parseDuration(field.value);
        if (ms > 0) {
          hbState.recalltime = ms + 5000;
        } else {
          await waitWhileBlocked();
          console.log(`[${tag}] hb no duration, retry 61s`);
          await delay(61000);
          return huntbotHandler();
        }
        isHunting = true;
      }

      if (field.name.includes('Duration')) {
        const match = field.name.match(/(\d+(\.\d+)?)H/);
        hbState.maxtime = match ? parseFloat(match[1]) : config.huntbot.maxtime;
      }

      if (field.name.includes('Animal Essence')) {
        const match = field.name.match(/Animal Essence - `(\d[\d,]*)`/);
        if (match && parseInt(match[1].replace(/,/g, ''), 10) > 0) {
          hbState.essence = true;
        }
      }
    }

    if (hbState.essence) {
      await delay(6100);
      await upgradeHuntbot();
    }

    if (isHunting) {
      console.log(`[${tag}] hb hunting, recall ${hbState.recalltime}ms`);
      await delay(hbState.recalltime);
      return huntbotHandler();
    } else {
      await delay(6100);
      return triggerHB();
    }
  }

  async function triggerHB() {
    await waitWhileBlocked();
    const sentMsg = await channel.send(
      `${randomChoice(['owo', 'owo'])} ${randomChoice(['autohunt', 'huntbot', 'hb', 'ah'])} ${hbState.maxtime}h`
    );

    const message = await waitForMessage(
      (msg) =>
        msg.content.includes('Here is your password') &&
        msg.author.id === '408785106942164992' &&
        msg.channel.id === channel.id &&
        msg.id > sentMsg.id,
      12000
    );

    if (!message) {
      console.log(`[${tag}] hb no captcha, retry 10m`);
      await delay(601000);
      return huntbotHandler();
    }

    const captchaImageURL = message.attachments.first()?.url;
    if (!captchaImageURL) {
      console.log(`[${tag}] hb no img, retry 10m`);
      await delay(601000);
      return huntbotHandler();
    }

    console.log(`[${tag}] hb solving captcha`);
    const solution = await solveHuntbotCaptcha(captchaImageURL);
    console.log(`[${tag}] hb captcha: ${solution}`);

    await delay(1600);

    const confirmMsg = await channel.send(
      `${randomChoice(['owo', 'owo'])} ${randomChoice(['autohunt', 'huntbot', 'hb', 'ah'])} ${hbState.maxtime}h ${solution}`
    );

    const successMsg = await waitForMessage(
      (msg) =>
        msg.content.includes('YOU SPENT') &&
        msg.author.id === '408785106942164992' &&
        msg.channel.id === channel.id &&
        msg.id > confirmMsg.id,
      12000
    );

    if (!successMsg) {
      await waitWhileBlocked();
      console.log(`[${tag}] hb no success, retry 61s`);
      await delay(61000);
      return huntbotHandler();
    }

    const ms = parseDuration(successMsg.content);
    if (ms > 0) {
      hbState.recalltime = ms + 5000;
      console.log(`[${tag}] hb started, recall ${hbState.recalltime}ms`);
      await delay(hbState.recalltime);
      return huntbotHandler();
    } else {
      await waitWhileBlocked();
      console.log(`[${tag}] hb no success duration, retry 61s`);
      await delay(61000);
      return huntbotHandler();
    }
  }

  async function upgradeHuntbot() {
    if (!config.huntbot.upgrade) return;
    await channel.send(
      `${randomChoice(['owo', 'owo'])} ${randomChoice(['upg', 'upgrade'])} ${config.huntbot.upgradetype} all`
    );
    console.log(`[${tag}] hb upgrade ${config.huntbot.upgradetype}`);
  }
};