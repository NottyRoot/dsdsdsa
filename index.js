const colors = require("colors");
const { client, env } = require('./setup');
const config = require('./config');

console.log(colors.grey(`[LOG] STARTING PROGRAM!`));
console.log(colors.grey(`[SETUP] CITY: ${env.city}, DELAY: ${env.delay}s`));
console.log(colors.grey(`[OPTIONS] MODE: ${config.options.mode}, TYPE: ${config.options.type}`));

// กำหนด user ID ที่จะส่ง DM แจ้งเตือน
const OWNER_USER_ID = process.env.OWNER_USER_ID || '1253933302033678477';

let lastUpdateTime = 0;
const minUpdateInterval = env.delay * 1000; // base delay in ms
let retryCount = 0;
const maxRetries = 5;
const errorNotifyThreshold = 3; // จำนวน error ที่จะเริ่มแจ้งเตือน

function getRandomDelay(baseDelay) {
  const variance = baseDelay * 0.3;
  return baseDelay + (Math.random() * variance * 2 - variance);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendErrorDM(message) {
  try {
    const user = await client.users.fetch(OWNER_USER_ID);
    await user.send(`⚠️ [BOT ERROR NOTIFY] ${message}`);
    console.log(colors.magenta(`[DM SENT] Notification sent to owner.`));
  } catch (err) {
    console.error(colors.red(`[DM ERROR] Failed to send DM: ${err.message}`));
  }
}

async function updatePresenceWithRetry(startedAt) {
  const now = Date.now();

  if (now - lastUpdateTime < minUpdateInterval) {
    const waitTime = minUpdateInterval - (now - lastUpdateTime);
    console.log(colors.blue(`[INFO] Waiting ${waitTime}ms to respect rate limit...`));
    await sleep(waitTime);
  }

  try {
    const activityName = replaceText(config.presence.text[0]);
    const activityState = replaceText(config.presence.text[1]);

    const activity = {
      name: activityName,
      type: "STREAMING",
      url: config.presence.watchUrl,
      state: activityState,
      timestamps: { start: startedAt },
      assets: {
        large_image: config.presence.imgBig,
        large_text: "Big Image",
        small_image: config.presence.imgSmall,
        small_text: "Small Image"
      }
    };

    client.user.setActivity(activity);
    lastUpdateTime = Date.now();
    retryCount = 0; // reset retry count on success
    console.log(colors.yellow(`[UPDATED] Presence updated at ${new Date(lastUpdateTime).toLocaleTimeString()}`));
  } catch (error) {
    retryCount++;
    const backoffTime = Math.min(60000, 1000 * 2 ** retryCount);
    const errorMsg = `Failed to update presence: ${error.message}. Retry #${retryCount} in ${backoffTime}ms`;
    console.error(colors.red(`[ERROR] ${errorMsg}`));

    if (retryCount >= errorNotifyThreshold) {
      await sendErrorDM(errorMsg);
    }

    if (retryCount <= maxRetries) {
      await sleep(backoffTime);
      await updatePresenceWithRetry(startedAt);
    } else {
      console.error(colors.red(`[ERROR] Max retries reached. Skipping update.`));
      retryCount = 0; // reset retry count after giving up
    }
  }
}

client.on('ready', () => {
  console.log(colors.green(`[READY] Logged in as ${client.user.tag}`));
  const startedAt = Date.now();

  async function scheduleUpdate() {
    await updatePresenceWithRetry(startedAt);
    const delay = getRandomDelay(minUpdateInterval);
    setTimeout(scheduleUpdate, delay);
  }

  scheduleUpdate();
});

client.login(process.env.TOKEN);

function replaceText(template) {
  const date = new Date();

  return template
    .replace(/{HR_24}/g, date.getHours().toString().padStart(2, '0'))
    .replace(/{MN_24}/g, date.getMinutes().toString().padStart(2, '0'))
    .replace(/{SC_24}/g, date.getSeconds().toString().padStart(2, '0'))
    .replace(/{TH_DT_N}/g, date.getDate().toString().padStart(2, '0'))
    .replace(/{EN_MTH_N}/g, (date.getMonth() + 1).toString().padStart(2, '0'))
    .replace(/{EN_YR_S}/g, date.getFullYear().toString().slice(-2))
    .replace(/{CTY}/g, env.city)
    .replace(/{PING}/g, Math.round(client.ws.ping))
    ;
}
