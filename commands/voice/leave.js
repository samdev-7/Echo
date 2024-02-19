const { SlashCommandBuilder, channelMention } = require("discord.js");

const { guildConnections, disconnect } = require("../../helpers/voiceHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave your voice channel and stop captions!"),
  async execute(interaction) {
    let channel = interaction.member.voice?.channel;
    if (channel == null) {
      await interaction.reply({
        content: "You need to be in a voice channel to use this command!",
        ephemeral: true,
      });
      return;
    }
    if (!guildConnections.has(interaction.guildId)) {
      await interaction.reply({
        content: "I'm not in a voice channel!",
        ephemeral: true,
      });
      return;
    }
    const connection = guildConnections.get(interaction.guildId);
    if (connection.channel.id != channel.id) {
      await interaction.reply({
        content: "I'm not in your voice channel!",
        ephemeral: true,
      });
      return;
    }

    try {
      disconnect(interaction.guildId);
      await interaction.reply({
        content: `I have left ${channelMention(channel.id)}.`,
        ephemeral: true,
      });
    } catch (e) {
      console.error(e);
      await interaction.reply({
        content: "There was an error while leaving your voice channel!",
        ephemeral: true,
      });
    }
  },
};
