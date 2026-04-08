import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
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
  const embed = new EmbedBuilder()
    .setTitle(data.title || 'Трек')
    .setURL(data.permalink_url || null)
    .setDescription('Статистика по треку SoundCloud')
    .addFields(
      { name: '▶ Прослушивания', value: formatNumber(data.playback_count), inline: true },
      { name: '❤ Лайки', value: formatNumber(data.likes), inline: true },
      { name: '💬 Комменты', value: formatNumber(data.comment_count), inline: true },
      { name: '🔁 Репосты', value: formatNumber(data.reposts_count), inline: true },
      { name: '⬇ Загрузки', value: formatNumber(data.download_count), inline: true },
      {
        name: '🕒 Обновлено',
        value: data.updatedAt
          ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>`
          : '—',
        inline: true
      }
    );

  if (data.artwork_url) {
    embed.setThumbnail(data.artwork_url);
  }

  return embed;
}

function buildArtistEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle(data.artist || 'Артист')
    .setDescription(`Всего треков: **${formatNumber(data.trackCount)}**`)
    .addFields(
      { name: '▶ Всего прослушиваний', value: formatNumber(data.playback_count), inline: true },
      { name: '❤ Всего лайков', value: formatNumber(data.likes), inline: true },
      { name: '💬 Всего комментариев', value: formatNumber(data.comments), inline: true },
      { name: '🔁 Всего репостов', value: formatNumber(data.reposts), inline: true },
      { name: '⬇ Всего загрузок', value: formatNumber(data.downloads), inline: true },
      {
        name: '🕒 Обновлено',
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
      name: '🔥 Топ 3 трека',
      value: top3
        .map((t, i) => `${i + 1}. **${t.title || 'Без названия'}** — ${formatNumber(t.playback_count)} plays`)
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

  return new EmbedBuilder()
    .setTitle(`Топ треков — ${data.artist || 'Артист'}`)
    .setDescription(
      tracks.length
        ? tracks
            .map((t, i) => `${i + 1}. **${t.title || 'Без названия'}** — ${formatNumber(t.playback_count)} plays`)
            .join('\n')
        : 'Нет данных'
    );
}

function buildWatchListEmbed(items) {
  return new EmbedBuilder()
    .setTitle('📌 Watchlist')
    .setDescription(
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
  await interaction.editReply({ embeds: [buildTrackEmbed(data)] });
}

async function handleArtist(url, interaction) {
  const data = await fetchJson(buildUrl('/api/dashboard', { url }));
  await interaction.editReply({ embeds: [buildArtistEmbed(data)] });
}

async function handleTop(url, interaction) {
  const data = await fetchJson(buildUrl('/api/dashboard', { url }));
  await interaction.editReply({ embeds: [buildTopEmbed(data)] });
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

client.once('ready', () => {
  console.log(`Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'sc') return;

  await interaction.deferReply();

  try {
    const handledWatch = await handleWatch(interaction);
    if (handledWatch) return;

    const sub = interaction.options.getSubcommand();
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