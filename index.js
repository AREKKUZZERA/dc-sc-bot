import 'dotenv/config';
import {
  Client,
 GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import {
  addWatchItem,
  listWatchItems,
  removeWatchItem,
  getWatchItem
} from './database.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const BASE_URL = (
  process.env.PROXY_SC_BASE_URL || 'https://proxy-sc.vercel.app'
).replace(/\/+$/, '');

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
}

function baseEmbed(title, description = '') {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xff5500)
    .setFooter({ text: 'SC Stats • SoundCloud Analytics' })
    .setTimestamp();
}

function buildTrackButtons(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`refresh_track|${encodeURIComponent(url)}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`watch_track|${encodeURIComponent(url)}`)
      .setLabel('Save')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setLabel('Open in SoundCloud')
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

function buildArtistButtons(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`refresh_artist|${encodeURIComponent(url)}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`top_artist|${encodeURIComponent(url)}`)
      .setLabel('Top Tracks')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`watch_artist|${encodeURIComponent(url)}`)
      .setLabel('Save')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setLabel('Open in SoundCloud')
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

function buildPanelEmbed() {
  return baseEmbed(
    'SC Stats Control Panel',
    [
      'Добро пожаловать в главное меню SoundCloud-бота.',
      '',
      '**Доступные разделы:**',
      '• Track Stats — статистика по треку',
      '• Artist Stats — статистика по артисту',
      '• Watchlist — сохранённые треки и артисты',
      '• Help — список команд'
    ].join('\n')
  ).addFields(
    {
      name: 'Quick Start',
      value: [
        '`/sc track url:<soundcloud track>`',
        '`/sc artist url:<soundcloud artist>`',
        '`/sc top url:<soundcloud artist>`',
        '`/sc panel`'
      ].join('\n'),
      inline: false
    }
  );
}

function buildPanelButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_open_track_modal')
        .setLabel('Track Stats')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('panel_open_artist_modal')
        .setLabel('Artist Stats')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('panel_watchlist')
        .setLabel('Watchlist')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('panel_help')
        .setLabel('Help')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildHelpEmbed() {
  return baseEmbed(
    'SC Stats Help',
    'Ниже основные команды бота.'
  ).addFields(
    {
      name: 'Track Commands',
      value: [
        '`/sc track url:<soundcloud track>`',
        '`/sc watch add-track url:<track> label:<optional>`'
      ].join('\n'),
      inline: false
    },
    {
      name: 'Artist Commands',
      value: [
        '`/sc artist url:<soundcloud artist>`',
        '`/sc top url:<soundcloud artist>`',
        '`/sc watch add-artist url:<artist> label:<optional>`'
      ].join('\n'),
      inline: false
    },
    {
      name: 'Watchlist',
      value: [
        '`/sc watch list`',
        '`/sc watch remove id:<id>`'
      ].join('\n'),
      inline: false
    },
    {
      name: 'Panel',
      value: '`/sc panel`',
      inline: false
    }
  );
}

function buildTrackHelpEmbed() {
  return baseEmbed(
    'Track Stats',
    'Как получить статистику по одному треку.'
  ).addFields(
    {
      name: 'Command',
      value: '`/sc track url:<soundcloud track url>`',
      inline: false
    },
    {
      name: 'Example',
      value: '`/sc track url:https://soundcloud.com/artist/track-name`',
      inline: false
    },
    {
      name: 'What you get',
      value: 'Plays, likes, comments, reposts, downloads, updated time.',
      inline: false
    }
  );
}

function buildArtistHelpEmbed() {
  return baseEmbed(
    'Artist Stats',
    'Как получить аналитику по артисту.'
  ).addFields(
    {
      name: 'Commands',
      value: [
        '`/sc artist url:<soundcloud artist url>`',
        '`/sc top url:<soundcloud artist url>`'
      ].join('\n'),
      inline: false
    },
    {
      name: 'Example',
      value: '`/sc artist url:https://soundcloud.com/artist-name`',
      inline: false
    },
    {
      name: 'What you get',
      value: 'Total plays, likes, comments, reposts, downloads, top tracks.',
      inline: false
    }
  );
}

function buildTrackModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_track_lookup')
    .setTitle('Track Stats');

  const urlInput = new TextInputBuilder()
    .setCustomId('track_url')
    .setLabel('SoundCloud track URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://soundcloud.com/artist/track-name')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(urlInput);
  modal.addComponents(row);

  return modal;
}

function buildArtistModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_artist_lookup')
    .setTitle('Artist Stats');

  const urlInput = new TextInputBuilder()
    .setCustomId('artist_url')
    .setLabel('SoundCloud artist URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://soundcloud.com/artist-name')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(urlInput);
  modal.addComponents(row);

  return modal;
}

function buildUrl(path, params = {}) {
  const url = new URL(path, BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Невалидный JSON от API: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `API error ${res.status}`);
  }

  return data;
}

function buildTrackEmbed(data) {
  const embed = baseEmbed(
    data.title || 'Track Overview',
    'Live SoundCloud track analytics'
  ).addFields(
    { name: 'Plays', value: formatNumber(data.playback_count), inline: true },
    { name: 'Likes', value: formatNumber(data.likes), inline: true },
    { name: 'Comments', value: formatNumber(data.comment_count), inline: true },
    { name: 'Reposts', value: formatNumber(data.reposts_count), inline: true },
    { name: 'Downloads', value: formatNumber(data.download_count), inline: true },
    {
      name: 'Updated',
      value: data.updatedAt
        ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>`
        : '—',
      inline: true
    }
  );

  if (data.artwork_url) {
    embed.setThumbnail(data.artwork_url);
  }

  if (data.permalink_url) {
    embed.setURL(data.permalink_url);
  }

  return embed;
}

function buildArtistEmbed(data) {
  const embed = baseEmbed(
    data.artist || 'Artist Overview',
    `Catalog overview • ${formatNumber(data.trackCount)} tracks`
  ).addFields(
    { name: 'Total Plays', value: formatNumber(data.playback_count), inline: true },
    { name: 'Total Likes', value: formatNumber(data.likes), inline: true },
    { name: 'Comments', value: formatNumber(data.comments), inline: true },
    { name: 'Reposts', value: formatNumber(data.reposts), inline: true },
    { name: 'Downloads', value: formatNumber(data.downloads), inline: true },
    {
      name: 'Updated',
      value: data.updatedAt
        ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>`
        : '—',
      inline: true
    }
  );

  const top3 = Array.isArray(data.tracks)
    ? [...data.tracks]
        .sort((a, b) => (b.playback_count || 0) - (a.playback_count || 0))
        .slice(0, 3)
    : [];

  if (top3.length) {
    embed.addFields({
      name: 'Top Performers',
      value: top3
        .map((t, i) => `${i + 1}. **${t.title || 'Untitled'}** — ${formatNumber(t.playback_count)}`)
        .join('\n')
    });
  }

  return embed;
}

function buildTopEmbed(data) {
  const tracks = Array.isArray(data.tracks)
    ? [...data.tracks]
        .sort((a, b) => (b.playback_count || 0) - (a.playback_count || 0))
        .slice(0, 10)
    : [];

  return baseEmbed(
    `Top Tracks — ${data.artist || 'Artist'}`,
    tracks.length
      ? tracks
          .map((t, i) => `**${i + 1}.** ${t.title || 'Untitled'} — ${formatNumber(t.playback_count)} plays`)
          .join('\n')
      : 'No data available'
  );
}

function buildWatchListEmbed(items) {
  return baseEmbed(
    '📌 Watchlist',
    items.length
      ? items.map(item => {
          const label = item.label ? ` — **${item.label}**` : '';
          return `\`${item.id}\` • **${item.type}**${label}\n${item.url}`;
        }).join('\n\n')
      : 'Список пуст'
  );
}

async function handleTrack(url, interaction) {
  const data = await fetchJson(buildUrl('/api/plays', { url }));
  await interaction.editReply({
    embeds: [buildTrackEmbed(data)],
    components: [buildTrackButtons(url)]
  });
}

async function handleArtist(url, interaction) {
  const data = await fetchJson(buildUrl('/api/dashboard', { url }));
  await interaction.editReply({
    embeds: [buildArtistEmbed(data)],
    components: [buildArtistButtons(url)]
  });
}

async function handleTop(url, interaction) {
  const data = await fetchJson(buildUrl('/api/dashboard', { url }));
  await interaction.editReply({
    embeds: [buildTopEmbed(data)],
    components: [buildArtistButtons(url)]
  });
}

async function handleWatch(interaction) {
  const sub = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);

  if (group !== 'watch') return false;

  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply('Эта команда работает только на сервере.');
    return true;
  }

  if (sub === 'add-track') {
    const url = interaction.options.getString('url', true);
    const label = interaction.options.getString('label');

    try {
      addWatchItem({
        userId,
        guildId,
        type: 'track',
        url,
        label
      });

      await interaction.editReply(`✅ Трек добавлен в watchlist.\n${url}`);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        await interaction.editReply('Этот трек уже есть в твоём watchlist.');
        return true;
      }
      throw error;
    }

    return true;
  }

  if (sub === 'add-artist') {
    const url = interaction.options.getString('url', true);
    const label = interaction.options.getString('label');

    try {
      addWatchItem({
        userId,
        guildId,
        type: 'artist',
        url,
        label
      });

      await interaction.editReply(`✅ Артист добавлен в watchlist.\n${url}`);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        await interaction.editReply('Этот артист уже есть в твоём watchlist.');
        return true;
      }
      throw error;
    }

    return true;
  }

  if (sub === 'list') {
    const items = listWatchItems({ userId, guildId });
    await interaction.editReply({ embeds: [buildWatchListEmbed(items)] });
    return true;
  }

  if (sub === 'remove') {
    const id = interaction.options.getInteger('id', true);
    const existing = getWatchItem({ id, userId, guildId });

    if (!existing) {
      await interaction.editReply('Запись с таким ID не найдена.');
      return true;
    }

    removeWatchItem({ id, userId, guildId });
    await interaction.editReply(`🗑 Удалено из watchlist: \`${id}\``);
    return true;
  }

  return false;
}

async function handlePanel(interaction) {
  await interaction.editReply({
    embeds: [buildPanelEmbed()],
    components: buildPanelButtons()
  });
}

client.once('ready', () => {
  console.log(`Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    try {
      const [action, rawUrl] = interaction.customId.split('|');
      const url = decodeURIComponent(rawUrl || '');

      if (action === 'panel_open_track_modal') {
        await interaction.showModal(buildTrackModal());
        return;
      }

      if (action === 'panel_open_artist_modal') {
        await interaction.showModal(buildArtistModal());
        return;
      }

      await interaction.deferUpdate();

      if (action === 'panel_watchlist') {
        if (!interaction.guildId) {
          await interaction.followUp({
            content: 'Эта кнопка работает только на сервере.',
            ephemeral: true
          });
          return;
        }

        const items = listWatchItems({
          userId: interaction.user.id,
          guildId: interaction.guildId
        });

        await interaction.editReply({
          embeds: [buildWatchListEmbed(items)],
          components: buildPanelButtons()
        });
        return;
      }

      if (action === 'panel_help') {
        await interaction.editReply({
          embeds: [buildHelpEmbed()],
          components: buildPanelButtons()
        });
        return;
      }

      if (action === 'panel_track_help') {
        await interaction.editReply({
          embeds: [buildTrackHelpEmbed()],
          components: buildPanelButtons()
        });
        return;
      }

      if (action === 'panel_artist_help') {
        await interaction.editReply({
          embeds: [buildArtistHelpEmbed()],
          components: buildPanelButtons()
        });
        return;
      }

      if (action === 'refresh_track') {
        const data = await fetchJson(buildUrl('/api/plays', { url }));
        await interaction.editReply({
          embeds: [buildTrackEmbed(data)],
          components: [buildTrackButtons(url)]
        });
        return;
      }

      if (action === 'refresh_artist') {
        const data = await fetchJson(buildUrl('/api/dashboard', { url }));
        await interaction.editReply({
          embeds: [buildArtistEmbed(data)],
          components: [buildArtistButtons(url)]
        });
        return;
      }

      if (action === 'top_artist') {
        const data = await fetchJson(buildUrl('/api/dashboard', { url }));
        await interaction.editReply({
          embeds: [buildTopEmbed(data)],
          components: [buildArtistButtons(url)]
        });
        return;
      }

      if (action === 'watch_track') {
        if (!interaction.guildId) return;

        try {
          addWatchItem({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            type: 'track',
            url,
            label: null
          });
        } catch {}

        await interaction.followUp({
          content: 'Трек сохранён в watchlist.',
          ephemeral: true
        });
        return;
      }

      if (action === 'watch_artist') {
        if (!interaction.guildId) return;

        try {
          addWatchItem({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            type: 'artist',
            url,
            label: null
          });
        } catch {}

        await interaction.followUp({
          content: 'Артист сохранён в watchlist.',
          ephemeral: true
        });
        return;
      }
    } catch (error) {
      console.error(error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `Ошибка: ${error.message}`,
          ephemeral: true
        });
      }
      return;
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      if (interaction.customId === 'modal_track_lookup') {
        const url = interaction.fields.getTextInputValue('track_url');

        await interaction.deferReply({ ephemeral: true });

        const data = await fetchJson(buildUrl('/api/plays', { url }));

        await interaction.editReply({
          embeds: [buildTrackEmbed(data)],
          components: [buildTrackButtons(url)]
        });

        return;
      }

      if (interaction.customId === 'modal_artist_lookup') {
        const url = interaction.fields.getTextInputValue('artist_url');

        await interaction.deferReply({ ephemeral: true });

        const data = await fetchJson(buildUrl('/api/dashboard', { url }));

        await interaction.editReply({
          embeds: [buildArtistEmbed(data)],
          components: [buildArtistButtons(url)]
        });

        return;
      }
    } catch (error) {
      console.error(error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `Ошибка: ${error.message}`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: `Ошибка: ${error.message}`
        });
      }
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'sc') return;

  await interaction.deferReply();

  try {
    const handledWatch = await handleWatch(interaction);
    if (handledWatch) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      await handlePanel(interaction);
      return;
    }

    const url = interaction.options.getString('url', true);

    if (sub === 'track') {
      await handleTrack(url, interaction);
      return;
    }

    if (sub === 'artist') {
      await handleArtist(url, interaction);
      return;
    }

    if (sub === 'top') {
      await handleTop(url, interaction);
      return;
    }

    await interaction.editReply('Неизвестная команда.');
  } catch (error) {
    console.error(error);
    await interaction.editReply(`Ошибка: ${error.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);