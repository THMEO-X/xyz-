const { notify } = require('../web/browse/sever');
const OWO_ID = "408785106942164992";

const CAPTCHA_TEXTS = [
  "please click on the character that represents a quantity or can be used for counting",
  "please click, hold, and drag the shape to complete the pattern",
  "please click, hold, and drag one of the elements on the right to complete the pairs",
  "please click on the shape that breaks the pattern",
  "please click on the object that is not shiny",
  "fill the boxes with the required number of objects indicated",
  "drag each missing peach",
  "click, hold and drag",
  "click, hold, and drag",
  "click on the shape that breaks the pattern",
];

const WEB_CAPTCHA_PHRASES = [
  "please complete your captcha",
  "verify that you are human",
  "are you a real human",
  "it may result in a ban",
  "please complete this within 10 minutes",
  "please use the link below so i can check",
  "please use the link",
  "captcha",
];

const SUSPICIOUS_PHRASES = [".com", "please use the link"];

function removeInvisibleChars(str) {
  return str.replace(/[\u200B-\u200D\uFEFF\u00AD\u180E\u2060]/g, "");
}

function universalCaptchaCheck(rawContent) {
  const hadZWSP = /[\u200B-\u200D\uFEFF\u00AD\u180E\u2060]/.test(rawContent);
  const clean   = removeInvisibleChars(rawContent).toLowerCase();
  const raw     = rawContent.toLowerCase();
  const allPhrases = [...CAPTCHA_TEXTS, ...WEB_CAPTCHA_PHRASES];

  for (const phrase of allPhrases) {
    if (clean.includes(phrase)) return { matched: true, phrase, hadZWSP };
  }
  if (!hadZWSP) {
    for (const phrase of allPhrases) {
      if (raw.includes(phrase)) return { matched: true, phrase, hadZWSP };
    }
  }
  return { matched: false, phrase: null, hadZWSP };
}

function isWebCaptchaMessage(cleanContent, hasOwobotButton, hasOwobotUrl) {
  const hasSuspicious = SUSPICIOUS_PHRASES.some((p) => cleanContent.includes(p));
  return hasSuspicious || hasOwobotButton || hasOwobotUrl;
}

function hasComponentCaptcha(components) {
  return components?.some((row) =>
    row.components?.some(
      (btn) =>
        btn.url?.includes("owobot.com/captcha") ||
        btn.label?.toLowerCase().includes("captcha")
    )
  );
}

function hasEmbedCaptcha(embeds) {
  return embeds?.some(
    (embed) =>
      embed.url?.includes("owobot.com/captcha") ||
      embed.description?.includes("owobot.com/captcha") ||
      embed.fields?.some((f) => f.value?.includes("owobot.com/captcha"))
  );
}

module.exports = function startCaptchaDetector(client, channelId, idUser, state) {
  

  let scanCount = 0;
  let lastLog   = "";

  function patchTargetChannel() {
    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.send || channel.__patched) return;

    const originalSend = channel.send.bind(channel);
    channel.send = async function (...args) {
      if (state.captcha || state.paused) {
        console.log("captcha/paused active");
        return null;
      }
      return originalSend(...args);
    };
    channel.__patched = true;
  }

  patchTargetChannel();

  client.on("channelCreate", (ch) => {
    if (ch.id === channelId) patchTargetChannel();
  });

  setInterval(() => {
    if (lastLog) {
      console.log(`[${scanCount} ] ${lastLog}`);
      lastLog = "";
    }
    scanCount = 0;
  }, 1000);

  function triggerCaptchaLock(reason) {
    if (state.captcha) return;
    state.captcha = true;
    state.paused  = true;
    patchTargetChannel();

    if (typeof client.broadcast === "function") {
      client.broadcast({ action: "update", type: "botstatus", status: "Paused", global: state });
      client.broadcast({ action: "update", type: "captcha", progress: (state.total?.captcha ?? 0) + 1, global: state });
      if (state.total) state.total.captcha = (state.total.captcha ?? 0) + 1;
    }

    lastLog = `⚠️ CAPTCHA — HARD LOCK | ${reason}`;
    console.log(` ${lastLog}`);

    const accountName = client.user?.tag ?? idUser;
    notify(
      ` Account (${accountName || idUser}) — Paused`,
      `Captcha! Bấm vào giải ngay.`,
      process.env.AAA || '/'
    ).catch(() => {});

    
    client.emit("captchaDetected", {
      token: client.token,
      channelId,
      idUser,
    });
  }

  // 
  client.on("messageCreate", (message) => {
    if (message.author.id !== OWO_ID) return;
    if (message.channel.id !== channelId) return;
    if (state.captcha) return;

    const { matched, phrase, hadZWSP } = universalCaptchaCheck(message.content);
    if (matched) {
      triggerCaptchaLock(`[LAYER 0 - UNIVERSAL${hadZWSP ? " ZWSP" : ""}] phrase: "${phrase}" | "${message.content.slice(0, 80)}"`);
    }
  });

  
  client.on("messageCreate", (message) => {
    if (message.author.id !== OWO_ID) return;
    if (message.channel.id !== channelId) return;
    if (state.captcha) return;

    const hasCaptchaEmbed  = hasEmbedCaptcha(message.embeds);
    const hasCaptchaButton = hasComponentCaptcha(message.components);
    if (hasCaptchaEmbed || hasCaptchaButton) {
      triggerCaptchaLock(`[LAYER 1 - EMBED/BTN] "${message.content.slice(0, 80)}"`);
    }
  });

  
  client.on("messageCreate", (message) => {
    if (message.author.id !== OWO_ID) return;
    if (message.channel.id !== channelId) return;
    if (state.captcha) return;

    const rawContent   = message.content.toLowerCase();
    const cleanContent = removeInvisibleChars(rawContent);
    const mentionsUser = rawContent.includes(`<@${idUser}>`);
    if (!mentionsUser) return;

    const hasWebPhrase = WEB_CAPTCHA_PHRASES.some((p) => cleanContent.includes(p));
    if (!hasWebPhrase) return;

    let hasOwobotButton = false;
    let hasOwobotUrl    = false;
    if (message.components.length > 0 && message.components[0]?.components[0]) {
      const btns      = message.components[0].components;
      hasOwobotButton = !!btns.find((btn) => btn.url?.toLowerCase() === "owobot.com");
      hasOwobotUrl    = btns[0].url?.toLowerCase().includes("owobot.com") ?? false;
    }

    if (isWebCaptchaMessage(cleanContent, hasOwobotButton, hasOwobotUrl)) {
      triggerCaptchaLock(`[LAYER 2 - WEB] "${message.content.slice(0, 80)}"`);
    }
  });

  
  client.on("messageCreate", (message) => {
    const isOwo  = message.author.id === OWO_ID;
    const isUser = message.author.id === idUser;
    if (!isOwo && !isUser) return;
    if (message.channel.id !== channelId) return;
    if (state.captcha) return;

    let count = 0;
    const interval = setInterval(() => {
      count++;
      scanCount++;
      if (state.captcha) { clearInterval(interval); return; }

      const { matched, phrase, hadZWSP } = universalCaptchaCheck(message.content);
      const hasCaptchaEmbed  = hasEmbedCaptcha(message.embeds);
      const hasCaptchaButton = hasComponentCaptcha(message.components);

      if (matched || hasCaptchaEmbed || hasCaptchaButton) {
        triggerCaptchaLock(
          `[LAYER 3 - INTERVAL${hadZWSP ? " ZWSP" : ""}] Từ: ${isOwo ? "OwO" : "User"} | phrase: "${phrase ?? "embed/btn"}" | "${message.content.slice(0, 80)}"`
        );
        clearInterval(interval);
        return;
      }
      if (count >= 10) clearInterval(interval);
    }, 100);
  });

  client.on("messageCreate", (message) => {
    if (message.author.id !== idUser) return;
    if (message.channel.id !== channelId) return;
    if (message.content !== "!TT") return;

    state.captcha = false;
    state.paused  = false;

    if (typeof client.broadcast === "function") {
      client.broadcast({ action: "update", type: "botstatus", status: "Running", global: state });
    }
    console.log(` resume${idUser} — channel ${channelId} `);
  });
};