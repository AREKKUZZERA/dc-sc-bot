import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const BASE_URL = process.env.PROXY_SC_BASE_URL?.replace(/\/+$/, '');

if (!BASE_URL) {
  throw new Error('PROXY_SC_BASE_URL is required');
}

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
      'Accept': 'application/json'
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
      { name: '🕒 Обновлено', value: data.updatedAt ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>` : '—', inline: true }
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
      { name: '🕒 Обновлено', value: data.updatedAt ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>` : '—', inline: true }
    );

  const top3 = Array.isArray(data.tracks)
    ? [...data.tracks].sort((a, b) => (b.playback_count || 0) - (a.playback_count || 0)).slice(0, 3)
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
    ? [...data.tracks].sort((a, b) => (b.playback_count || 0) - (a.playback_count || 0)).slice(0, 10)
    : [];

  const embed = new EmbedBuilder()
    .setTitle(`Топ треков — ${data.artist || 'Артист'}`)
    .setDescription(
      tracks.length
        ? tracks
            .map((t, i) => `${i + 1}. **${t.title || 'Без названия'}** — ${formatNumber(t.playback_count)} plays`)
            .join('\n')
        : 'Нет данных'
    );

  return embed;
}

client.once('ready', () => {
  console.log(`Бот запущен как ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'sc') return;

  const sub = interaction.options.getSubcommand();
  const url = interaction.options.getString('url', true);

  await interaction.deferReply();

  try {
    if (sub === 'track') {
      const data = await fetchJson(buildUrl('/api/plays', { url }));
      await interaction.editReply({ embeds: [buildTrackEmbed(data)] });
      return;
    }

    if (sub === 'artist') {
      const data = await fetchJson(buildUrl('/api/dashboard', { url }));
      await interaction.editReply({ embeds: [buildArtistEmbed(data)] });
      return;
    }

    if (sub === 'top') {
      const data = await fetchJson(buildUrl('/api/dashboard', { url }));
      await interaction.editReply({ embeds: [buildTopEmbed(data)] });
      return;
    }

    await interaction.editReply('Неизвестная подкоманда');
  } catch (error) {
    console.error(error);
    await interaction.editReply(`Ошибка: ${error.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);