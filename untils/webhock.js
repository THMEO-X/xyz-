// FARM/webhook.js
const https = require("https");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1341413844244893736/unnwq7z8_Uzi1LHluQsIlOt4J_yty9TrosKAT1L1EpG1oNQ0c61rr1ueFOFLedaNXQwc";
const IMAGE_URL = "https://cdn.discordapp.com/attachments/1336313310542561300/1342117509847056464/image0.gif";

const startTime = Date.now();

function getUptime() {
  const ms = Date.now() - startTime;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function sendWebhook(stats) {
  const payload = JSON.stringify({
    embeds: [{
      color: 0xB535F3,
      fields: [
        { name: " Hunt", value: `${stats.hunt} lần`, inline: true },
        { name: "⚔ Battle", value: `${stats.battle} lần`, inline: true },
        { name: "⏱Uptime", value: getUptime(), inline: true },

      ],
      image: { url: IMAGE_URL },
      timestamp: new Date().toISOString(),
    }]
  });

  const url = new URL(WEBHOOK_URL);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  });
  req.on("error", (err) => console.log("❌ Webhook error:", err.message));
  req.write(payload);
  req.end();
}

module.exports = function startStatsCommand(client, stats) {
  client.on("messageCreate", (message) => {
    if (message.author.id !== client.user.id) return;
    if (message.content.trim() !== "stats") return;
    sendWebhook(stats);
    console.log("📊 Stats sent.");
  });
};