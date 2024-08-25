
async function handleRequest(request, env) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  const url = new URL(request.url);
  if (url.pathname !== '/playlist') {
    return new Response('Not found', { status: 404 });
  }

  const channels = new Channels(env);
  const response = await channels.getPlaylist(request);

  // Add CORS headers to the actual response
  return addCORSHeaders(response);
}

function handleCORS(request) {
  // Handle CORS preflight request
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function addCORSHeaders(response) {
  // Clone the response and add CORS headers
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://betamaxmas.com',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

class Channels {
  constructor(env) {
    this.CACHE_TIME = 86400; // 24 hours
    this.CACHE_KEY = 'playlist_cache';
    this.PLAYLISTS = ['PLEE193C2FEDC59D2F'];
    this.CHANNEL_NAMES = ['21', '27', '33'];
    this.API_KEY = env.YOUTUBE_API_KEY
    // this.KV = env.BETAMAXMAS;
  }

  async getPlaylist(request) {
    const url = new URL(request.url);
    const noCache = url.searchParams.has('nocache');

    let output = noCache ? null : await this.getCachedPlaylist();

    if (!output) {
      output = await this.getPlaylistsFromYT();
      await this.cachePlaylist(output);
    }

    return new Response(JSON.stringify({
      cached: !noCache,
      time: Date.now(),
      channels: output
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getCachedPlaylist() {
    // This is a placeholder. Implement using Cloudflare KV or other storage
    // return await NAMESPACE.get(this.CACHE_KEY);
    return null;
  }

  async cachePlaylist(output) {
    // This is a placeholder. Implement using Cloudflare KV or other storage
    // await NAMESPACE.put(this.CACHE_KEY, JSON.stringify(output), {expirationTtl: this.CACHE_TIME});
  }

  async getPlaylistsFromYT() {
    const videos = await this.fetchAllVideos();
    return this.groupVideosByChannel(videos);
  }

  async fetchAllVideos() {
    const videos = [];
    for (const playlistId of this.PLAYLISTS) {
      let pageToken = null;
      do {
        const playlist = await this.loadPlaylist(playlistId, pageToken);
        if (!playlist) break;

        const validVideos = await Promise.all(playlist.items.map(async item => {
          const video = await this.loadVideo(item.snippet.resourceId.videoId);
          return video && video.items[0]?.status.embeddable ? new Video(item.snippet, video) : null;
        }));

        videos.push(...validVideos.filter(Boolean));
        pageToken = playlist.nextPageToken;
      } while (pageToken);
    }
    return videos;
  }

  groupVideosByChannel(videos) {
    const channels = this.CHANNEL_NAMES.map(name => ({ number: name, duration: 0, shows: [] }));

    videos.forEach((video, index) => {
      const channelIndex = index % this.CHANNEL_NAMES.length;
      channels[channelIndex].shows.push({
        id: video.id,
        title: video.title,
        duration: video.duration
      });
      channels[channelIndex].duration += video.duration;
    });

    return channels;
  }

  async loadPlaylist(id, pageToken = null) {
    const params = new URLSearchParams({
      maxResults: '50',
      part: 'snippet',
      playlistId: id,
      key: this.API_KEY,
      ...(pageToken && { pageToken })
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.items?.length ? data : null;
  }

  async loadVideo(id) {
    const params = new URLSearchParams({
      part: 'contentDetails,status',
      id: id,
      key: this.API_KEY
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    return response.ok ? response.json() : null;
  }
}

class Video {
  constructor(snippet, video) {
    this.id = snippet.resourceId.videoId;
    this.title = Video.toTitleCase(snippet.title);
    this.duration = Video.parseDuration(video.items[0].contentDetails.duration);
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
    return handleRequest(request, env)
  }
}