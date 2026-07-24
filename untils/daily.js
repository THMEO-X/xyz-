// utils/daily.js
const fs = require("fs");
const path = require("path");
const schedule = require("node-cron");

const STATS_PATH = path.join(__dirname, "./stats.json");

function loadJson() {
  return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));
}

function saveJson(data) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(data, null, 4), "utf-8");
}

function timeInSeconds() {
  return Math.floor(Date.now() / 1000);
}

class Daily {
  constructor(bot) {
    this.bot = bot;
    this._cronJob = null;
  }

  get cooldowns() {
    return this.bot.settingsDict.cooldowns;
  }

  startDailyTimer(client, channelId) {
    this._cronJob = schedule.schedule(
      "0 0 8 * * *",
      async () => {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
          console.log("Daily timer: khong tim thay channel");
          return;
        }

        try {
          await channel.send("owo daily");
          console.log(
            `Daily gui luc 15:00 VN — ${new Date().toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            })}`
          );
        } catch (err) {}
      },
      { timezone: "Asia/Ho_Chi_Minh" }
    );
  }

  async startDaily() {
    const accounts = loadJson();
    const userId = String(this.bot.user.id);

    if (accounts[userId]) {
      const lastDailyTime = accounts[userId].daily || 0;

      if (!this.bot.shouldRun(lastDailyTime)) {
        await this.bot.sleepTill(this.bot.calcTime());
      }

      await this.bot.sleepTill(this.cooldowns.briefCooldown);
      await this.bot.putQueue(
        { cmd_name: "daily", prefix: true, checks: true, id: "daily" },
        { priority: true }
      );
      await this.bot.setStat(false);
    }
  }

  async onCogLoad(client, channelId) {
    if (!this.bot.settingsDict.daily) {
      await this.bot.unloadCog("core.cogs.daily");
      return;
    }

    this.startDailyTimer(client, channelId);
    this.startDaily();
  }

  async onCogUnload() {
    if (this._cronJob) {
      this._cronJob.stop();
    }
    await this.bot.removeQueue({ id: "daily" });
  }

  async handleMessage(message) {
    const nick = this.bot.getNick(message);
    const cmd = { cmd_name: "daily", prefix: true, checks: true, id: "daily" };

    if (
      message.channel.id === this.bot.cm.id &&
      message.author.id === this.bot.owoBotId &&
      message.content.includes(nick)
    ) {
      if (message.content.includes("Here is your daily **<:cowoncy:")) {
        const match = message.content.match(
          /Here is your daily \*\*<:cowoncy:\d+> ([\d,]+)/
        );

        await this.bot.removeQueue(cmd);
        await this.bot.setStat(true);

        if (match) {
          const amount = parseInt(match[1].replace(/,/g, ""), 10);
          this.bot.updateCash(amount);
        }

        await this.bot.sleepTill(this.bot.calcTime());
        await this.bot.sleepTill(this.cooldowns.moderateCooldown);
        await this.bot.putQueue(cmd, { priority: true });
        await this.bot.setStat(false);

        const accounts = loadJson();
        accounts[String(this.bot.user.id)].daily = timeInSeconds();
        saveJson(accounts);

        if (this.bot.globalSettingsDict?.webhook?.enabled) {
          await this.bot.sendWebhook("daily_claim");
        }
      }

      if (
        message.content.includes("**⏱ |** Nu! **") &&
        message.content.includes("! You need to wait")
      ) {
        await this.bot.removeQueue(cmd);
        await this.bot.setStat(true);
        await this.bot.sleepTill(this.bot.calcTime());
        await this.bot.sleepTill(this.cooldowns.moderateCooldown);
        await this.bot.putQueue(cmd, { priority: true });
        await this.bot.setStat(false);
      }
    }
  }
}

module.exports = Daily;