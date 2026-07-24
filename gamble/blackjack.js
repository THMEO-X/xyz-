const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OWO_ID = "408785106942164992";
const randomInt = (min, max) => Math.floor(Math.random() * (max - min) + min);
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

const BET_AMOUNT = 1000;

let qValues = null;

function loadQValues() {
  try {
    const data = fs.readFileSync(
      path.join(__dirname, '../utils/q_values.json'), 'utf-8'
    );
    qValues = JSON.parse(data);
    console.log(" Q-values loaded");
  } catch (err) {
    console.log("  q_values.json:", err.message);
  }
}

function getBestAction(dealerShow, playerSum, hasAce) {
  const key = JSON.stringify([dealerShow, playerSum, hasAce]).replace(/,/g, ", ");
  const q = qValues?.[key];
  if (q) return q.indexOf(Math.max(...q));
  return randomInt(0, 2);
}

module.exports = function startBlackjack(client, channel, global) {
  if (process.env.BLACKJACK !== 'true') {
    console.log("");
    return;
  }

  loadQValues();
  console.log("");
  bjLoop(client, channel, global);
};

async function bjLoop(client, channel, global) {
  while (global.paused || global.captcha) {
    await delay(16000);
  }

  try {
    channel.sendTyping();
    await delay(randomInt(500, 1500));

    await channel.send(
      `${randomChoice(["owo", "owo"])} ${randomChoice(["blackjack", "bj", "21"])} ${BET_AMOUNT}`
    );

    console.log(` Blackjack bet: ${BET_AMOUNT}`);

    const bjMsg = await waitForBJMessage(client, channel);

    if (!bjMsg) {
      console.log("");
    } else {
      await delay(randomInt(2000, 4000));
      await handleBlackjack(client, bjMsg, global);
    }

  } catch (err) {
    console.log(":", err.message);
  } finally {
    const next = randomInt(16000, 34000);
    console.log(` Blackjack  ${(next / 1000).toFixed(1)}s`);
    setTimeout(() => bjLoop(client, channel, global), next);
  }
}

async function handleBlackjack(client, message, global) {
  try {
    await delay(randomInt(600, 1200));

    const embed = message.embeds[0];
    if (!embed) return;

    if (embed.color !== 8240363) {
      if (embed.color === 16711680) {
        console.log(`🔴 Thua ${BET_AMOUNT}`);
      } else if (embed.color === 65280) {
        console.log(`🟢 Thắng ${BET_AMOUNT}`);
      } else {
        console.log(`⚪ Hòa ${BET_AMOUNT}`);
      }
      return;
    }

    const dealerMatch = embed.fields[0]?.name.match(/`\[(\d+).*\]\*?`/);
    const playerMatch = embed.fields[1]?.name.match(/`\[(\d+)\]\*?`/);

    const dealerShow = dealerMatch?.[1];
    const playerSum = playerMatch?.[1];

    if (!dealerShow || !playerSum) {
      console.log("");
      return;
    }

    const hasAce = embed.fields[1]?.name.includes("*") ? 1 : 0;
    const action = getBestAction(Number(dealerShow), Number(playerSum), hasAce);

    console.log(` Dealer: ${dealerShow} | Player: ${playerSum} | ${action === 1 ? "HIT 👊" : "STAND 🛑"}`);

    await delay(randomInt(500, 1500));

    const reactions = message.reactions;
    const emoji = action === 1 ? "👊" : "🛑";
    const existing = reactions.cache.find(r => r.emoji.name === emoji);

    if (existing?.me) {
      await existing.users.remove(client.user.id);
    } else {
      await message.react(emoji);
    }

    await delay(randomInt(500, 1000));

    const updated = await message.channel.messages.fetch(message.id);
    await handleBlackjack(client, updated, global);

  } catch (err) {
    console.log("❌ Lỗi handle blackjack:", err.message);
  }
}

function waitForBJMessage(client, channel) {
  return new Promise((resolve) => {
    let done = false;

    const listener = (msg) => {
      if (
        msg.author.id === OWO_ID &&
        msg.channel.id === channel.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].author?.name.toLowerCase().includes("blackjack") &&
        !done
      ) {
        done = true;
        client.off("messageCreate", listener);
        resolve(msg);
      }
    };

    client.on("messageCreate", listener);

    setTimeout(() => {
      if (!done) {
        done = true;
        client.off("messageCreate", listener);
        resolve(null);
      }
    }, 15000);
  });
}