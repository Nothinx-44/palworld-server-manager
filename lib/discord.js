const axios = require('axios');

async function notify(message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return; // pas configuré, on ignore silencieusement
  try {
    await axios.post(webhookUrl, { content: message });
  } catch (err) {
    console.error('Notification Discord échouée:', err.message);
  }
}

module.exports = { notify };
