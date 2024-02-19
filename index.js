const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  REST,
  Routes,
} = require("discord.js");
const { BOT_TOKEN, APP_ID } = require("./config.json");
const { guildConnections, disconnect } = require("./helpers/voiceHelper");
const { destroyTranscriber } = require("./helpers/transcriptionHelper");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.commands = new Collection();
const commandsJSON = [];

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      commandsJSON.push(command.data.toJSON());
    } else {
      console.warn(
        `The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const rest = new REST().setToken(BOT_TOKEN);

(async () => {
  try {
    console.debug(
      `Started refreshing ${commandsJSON.length} application (/) commands.`
    );

    const data = await rest.put(Routes.applicationCommands(APP_ID), {
      body: commandsJSON,
    });

    console.info(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // Ignore bots
  if (oldState.member.user.bot) {
    return;
  }

  // We only care about channels the bot is in
  if (!guildConnections.has(newState.guild.id)) {
    return;
  }
  const connection = guildConnections.get(newState.guild.id);
  const channel = connection.channel;
  if (oldState.channelId != channel.id && newState.channelId != channel.id) {
    return;
  }

  if (oldState.channelId == channel.id && newState.channelId != channel.id) {
    console.log(
      `${oldState.member.user.username} left ${oldState.channel.name}`
    );
    destroyTranscriber(oldState.member.id);

    let humans = oldState.channel.members.filter((member) => !member.user.bot);

    if (humans.size == 0) {
      console.log("I'm alone in the voice channel, disconnecting.");
      await disconnect(newState.guild.id);
    }
  } else if (
    oldState.channelId != channel.id &&
    newState.channelId == channel.id
  ) {
    console.log(
      `${newState.member.user.username} joined ${newState.channel.name}`
    );
  }
});

client.login(BOT_TOKEN);
