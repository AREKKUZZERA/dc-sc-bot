import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('sc')
    .setDescription('SoundCloud статистика')
    .addSubcommand(sub =>
      sub
        .setName('track')
        .setDescription('Статистика по треку')
        .addStringOption(opt =>
          opt
            .setName('url')
            .setDescription('Ссылка на SoundCloud трек')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('artist')
        .setDescription('Статистика по артисту')
        .addStringOption(opt =>
          opt
            .setName('url')
            .setDescription('Ссылка на профиль SoundCloud')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('top')
        .setDescription('Топ треков артиста')
        .addStringOption(opt =>
          opt
            .setName('url')
            .setDescription('Ссылка на профиль SoundCloud')
            .setRequired(true)
        )
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_GUILD_ID
  ),
  { body: commands }
);

console.log('Команды зарегистрированы');