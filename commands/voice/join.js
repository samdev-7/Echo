const {
  SlashCommandBuilder,
  ChannelType,
  channelMention,
} = require("discord.js");

const {
  guildConnections,
  connect,
  disconnect,
} = require("../../helpers/voiceHelper");

const { WEB_ENDPOINT } = require("./../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join your voice channel and start captions!"),
  async execute(interaction) {
    let channel = interaction.member.voice?.channel;
    if (channel == null) {
      await interaction.reply({
        content: "You need to be in a voice channel to use this command!",
        ephemeral: true,
      });
      return;
    }
    if (guildConnections.has(interaction.guildId)) {
      await interaction.reply({
        content: "I'm already in a voice channel!",
        ephemeral: true,
      });
      return;
    }
    if (!channel.joinable) {
      await interaction.reply({
        content: "I cannot join your voice channel!",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    try {
      await connect(
        channel,
        interaction,
        async (oldState, newState) => {
          await channel.send("Stopped caption generation.");
          console.log("disconnected");
        },
        async () => {
          await interaction.editReply({
            content: `Caption generation started in ${channelMention(
              channel.id
            )}.`,
            ephemeral: true,
          });
          await channel.send(
            `Caption generation started in this channel.${
              WEB_ENDPOINT
                ? "\nYou can view real time captions at " +
                  WEB_ENDPOINT +
                  "captions?id=" +
                  interaction.guildId
                : ""
            }`
          );
        }
      );
    } catch (e) {
      console.error(e);
      await interaction.editReply({
        content: "There was an error while joining your voice channel!",
        ephemeral: true,
      });
    }
  },
};
