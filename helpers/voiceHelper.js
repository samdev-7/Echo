const { OpusEncoder } = require("@discordjs/opus");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType,
} = require("@discordjs/voice");
const {
  transcribe,
  get_partial,
  get_final,
  destroyTranscriber,
} = require("./transcriptionHelper");
const { getWebhook } = require("./webhookHelper");
const {
  sendToAll,
  sendFromGuild,
  unsubscribeGuild,
} = require("./socketHelper");
const { guildConnections } = require("./guildHelper");

async function connect(
  channel,
  interaction,
  on_disconnect = async (oldState, newState) => {},
  on_ready = async () => {}
) {
  const webhook = await getWebhook(channel);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guildId,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: false,
  });

  guildConnections.set(channel.guildId, {
    channel,
    connection,
  });

  connection.on(VoiceConnectionStatus.Ready, async () => {
    await on_ready();
  });

  // https://discordjs.guide/voice/voice-connections.html#handling-disconnects
  connection.on(
    VoiceConnectionStatus.Disconnected,
    async (oldState, newState) => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        const members = channel.members;
        for (const [memberId, member] of members) {
          destroyTranscriber(memberId);
        }
        connection.destroy();
        guildConnections.delete(channel.guildId);
        unsubscribeGuild(channel.guildId);
        await on_disconnect(oldState, newState);
      }
    }
  );

  recieve(connection, channel, interaction, webhook);
}

async function recieve(connection, channel, interaction, webhook) {
  const receiver = connection.receiver;
  const voiceMembers = channel.members;

  receiver.speaking.on("start", (userId) => {
    if (!voiceMembers.has(userId)) {
      return;
    }
    if (voiceMembers.get(userId).user.bot) {
      return;
    }

    const member = voiceMembers.get(userId);

    console.log(`User ${member.user?.username} started speaking`);

    const stream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterInactivity,
        duration: 100,
      },
    });

    const opus = new OpusEncoder(48000, 2); // Discord uses 2 channel 48KHz

    let buffers = [];
    let chunkCount = 0;

    stream.on("data", async (chunk) => {
      const pcm = opus.decode(chunk);
      const mono = Buffer.alloc(pcm.length / 2);

      // Convert to mono
      for (let i = 0; i < mono.length; i += 4) {
        mono.writeInt16LE(pcm.readInt16LE(i), i / 2);
      }

      //buffers.push(mono);
      transcribe(userId, mono);
      chunkCount++;

      if (chunkCount >= 16) {
        chunkCount = 0;
        let partial = await get_partial(userId);
        if (partial.length > 0) {
          sendFromGuild(channel.guildId, {
            type: "captions",
            content: partial,
            guildId: channel.guildId,
            userId,
          });
        }
      }
    });
    stream.on("end", async () => {
      const final = await get_final(userId);
      if (final.length > 0) {
        console.log("Result: ", final);
        sendFromGuild(channel.guildId, {
          type: "captions",
          content: final,
          guildId: channel.guildId,
          userId,
        });
        await webhook.send({
          content: final,
          username:
            member.nickname || member.displayName || member.user.username,
          avatarURL: member.user.displayAvatarURL(),
        });
      }
    });
  });
}

async function disconnect(guildId) {
  if (guildConnections.has(guildId)) {
    const connection = guildConnections.get(guildId).connection;
    const channel = guildConnections.get(guildId).channel;
    unsubscribeGuild(guildId);
    connection.destroy();
    guildConnections.delete(guildId);
    await channel.send("Stopped caption generation.");
  }
}

module.exports = {
  guildConnections,
  connect,
  disconnect,
};
