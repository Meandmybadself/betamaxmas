// Constants
const CACHE_KEY = 'playlist_cache';
const TIMESTAMP_KEY = 'last_update_timestamp';
const PLAYLISTS = ['PLEE193C2FEDC59D2F'];
const CHANNEL_NAMES = ['21', '27', '33'];
const VIDEO_LIMIT = 50;

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://betamaxmas.com',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Main handler
async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  const url = new URL(request.url);
  if (url.pathname === '/playlist') {
    const response = await getPlaylist(request, env);
    return addCORSHeaders(response);
  }

  return new Response('Not found', { status: 404 });
}

// CORS handlers
function handleCORS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function addCORSHeaders(response) {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => newHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Playlist functions
async function getPlaylist(request, env) {
  const url = new URL(request.url);
  const noCache = url.searchParams.has('nocache');

  let output = noCache ? null : await getCachedPlaylist(env.CHANNELS);

  if (!output) {
    output = await getPlaylistsFromYT(env.YOUTUBE_API_KEY);
    await cachePlaylist(env.CHANNELS, output);
  }

  return new Response(JSON.stringify({
    cached: !noCache && output !== null,
    time: Date.now(),
    channels: output
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getCachedPlaylist(kv) {
  try {
    const cachedData = await kv.get(CACHE_KEY, 'json');
    const lastUpdateTimestamp = await kv.get(TIMESTAMP_KEY, 'text');

    if (cachedData && lastUpdateTimestamp) {
      const currentDate = new Date();
      const lastUpdateDate = new Date(parseInt(lastUpdateTimestamp));

      // Check if the cache is from today
      if (currentDate.toDateString() === lastUpdateDate.toDateString()) {
        console.log('Retrieved playlist from cache');
        return cachedData;
      }
    }
  } catch (error) {
    console.error('Error retrieving from cache:', error);
  }
  return null;
}

async function cachePlaylist(kv, output) {
  try {
    const currentTimestamp = Date.now();
    await kv.put(CACHE_KEY, JSON.stringify(output));
    await kv.put(TIMESTAMP_KEY, currentTimestamp.toString());
    console.log('Playlist cached successfully');
  } catch (error) {
    console.error('Error caching playlist:', error);
  }
}

async function getPlaylistsFromYT(apiKey) {
  const videos = await fetchAllVideos(apiKey);
  return groupVideosByChannel(videos);
}

async function fetchAllVideos(apiKey) {
  const videos = [];
  for (const playlistId of PLAYLISTS) {
    let pageToken = null;
    do {
      const playlist = await loadPlaylist(playlistId, pageToken, apiKey);
      if (!playlist) break;

      const videoIds = playlist.items.map(item => item.snippet.resourceId.videoId);
      const validVideos = await loadVideos(videoIds, apiKey);
      videos.push(...validVideos);
      pageToken = playlist.nextPageToken;
    } while (pageToken);
  }
  return videos;
}

function groupVideosByChannel(videos) {
  return CHANNEL_NAMES.map((name, index) => ({
    number: name,
    duration: 0,
    shows: videos.filter((_, i) => i % CHANNEL_NAMES.length === index)
      .map(video => {
        return {
          id: video.id,
          title: video.title,
          duration: video.duration
        };
      })
  })).map(channel => {
    channel.duration = channel.shows.reduce((sum, show) => sum + show.duration, 0);
    return channel;
  });
}

// YouTube API functions
async function loadPlaylist(id, pageToken, apiKey) {
  const params = new URLSearchParams({
    maxResults: VIDEO_LIMIT,
    part: 'snippet',
    playlistId: id,
    key: apiKey,
    ...(pageToken && { pageToken })
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
  if (!response.ok) {
    console.error('Error loading playlist:', response.statusText);
    return null;
  }

  const data = await response.json();
  return data.items?.length ? data : null;
}

async function loadVideos(ids, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails,status',
    id: ids.join(','),
    key: apiKey
  });

  const requestURL = `https://www.googleapis.com/youtube/v3/videos?${params}`;
  const response = await fetch(requestURL);

  if (!response.ok) {
    console.error('Error loading videos:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.items
    .filter(item => item.status.embeddable && item.status.privacyStatus === 'public')
    .map(item => new Video(item.snippet, item));
}

// Video class
class Video {
  constructor(snippet, video) {
    this.id = video.id;
    this.title = Video.toTitleCase(snippet.title);
    this.duration = Video.parseDuration(video.contentDetails.duration);
    this.embeddable = video.status.embeddable;
    this.privacyStatus = video.status.privacyStatus;
  }

  static toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  static parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const [, hours = 0, minutes = 0, seconds = 0] = match;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
}