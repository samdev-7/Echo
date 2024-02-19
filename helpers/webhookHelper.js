async function getWebhook(channel) {
  const webhooks = await channel.fetchWebhooks();
  const webhook = webhooks.find((webhook) => webhook.name === "EchoBot");
  if (webhook) {
    return webhook;
  }
  return createWebhook(channel);
}

async function createWebhook(channel) {
  const webhook = await channel.createWebhook({
    name: "EchoBot",
  });
  return webhook;
}

module.exports = {
  getWebhook,
};
