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

    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Открыть главное меню SC Stats')
    )

    .addSubcommandGroup(group =>
      group
        .setName('watch')
        .setDescription('Watchlist')
        .addSubcommand(sub =>
          sub
            .setName('add-track')
            .setDescription('Добавить трек в watchlist')
            .addStringOption(opt =>
              opt
                .setName('url')
                .setDescription('Ссылка на трек')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt
                .setName('label')
                .setDescription('Своя подпись')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('add-artist')
            .setDescription('Добавить артиста в watchlist')
            .addStringOption(opt =>
              opt
                .setName('url')
                .setDescription('Ссылка на профиль')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt
                .setName('label')
                .setDescription('Своя подпись')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('Показать watchlist')
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Удалить из watchlist')
            .addIntegerOption(opt =>
              opt
                .setName('id')
                .setDescription('ID записи')
                .setRequired(true)
            )
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