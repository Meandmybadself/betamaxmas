// TVGuide class
class TVGuide {
  constructor(channelData, start) {
    this.channelData = channelData;
    this.start = start;
    this.sortedChannelData = this.sortChannelData();
    this.longestDurationTime = this.findLongestDuration();
    this.localStart = start % this.longestDurationTime;
  }

  sortChannelData() {
    let sortedData = [];
    for (const channel of this.channelData.channels) {
      let playTime = 0;
      for (const show of channel.shows) {
        show.start = playTime;
        sortedData.push(show);
        playTime += show.duration;
      }
    }
    return sortedData.sort((a, b) => a.start - b.start);
  }

  findLongestDuration() {
    return Math.max(...this.channelData.channels.map(channel => channel.duration));
  }
}

// RemoteControl class
class RemoteControl {
  constructor(handlers) {
    this.handlers = handlers;
    this.isLocked = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const remoteButtons = ['chan-up', 'chan-down', 'vol-up', 'vol-down', 'fullscreen'];
    remoteButtons.forEach(id => {
      document.getElementById(id).addEventListener('click', (e) => this.clickHandler(e));
    });
  }

  lock() {
    this.isLocked = true;
  }

  unlock() {
    this.isLocked = false;
  }

  clickHandler(e) {
    if (this.isLocked) return;
    const action = e.target.id;
    if (this.handlers[action]) {
      this.handlers[action]();
    }
  }
}

// Betamaxmas class
class Betamaxmas {
  constructor() {
    this.apiEndpoint = 'https://api.betamaxmas.com/playlist';
    this.isMuted = true;
    this.loadPlaylist();
  }

  loadPlaylist() {
    fetch(this.apiEndpoint)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(playlist => this.onPlaylistLoaded(playlist))
      .catch(error => {
        console.error('Error fetching playlist:', error);
        alert("Couldn't communicate with server. Please try again later.");
      });
  }

  onPlaylistLoaded(playlist) {
    this.playlist = playlist;
    this.startTime = this.getNow();
    this.tvguide = new TVGuide(this.playlist, this.startTime);
    this.injectYTScript();
  }

  injectYTScript() {
    window.onYouTubeIframeAPIReady = () => this.onYTPlayerReady();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.getElementsByTagName("script")[0].parentNode.appendChild(tag);
  }

  onYTPlayerReady() {
    this.setupRemote();
    this.setupEventListeners();
    document.querySelector(".container").classList.add("started");
    this.initializeFromHash();
  }

  setupRemote() {
    this.remote = new RemoteControl({
      'vol-up': () => this.onVolumeUpClick(),
      'vol-down': () => this.onVolumeDownClick(),
      'chan-up': () => this.onChannelUpClick(),
      'chan-down': () => this.onChannelDownClick(),
      'fullscreen': () => this.onFullscreenClick()
    });
  }

  setupEventListeners() {
    document.addEventListener("fullscreenchange", () => this.onFullscreenChange());
    window.addEventListener("resize", () => this.onResize());
    document.getElementById("about").addEventListener("click", () => this.onAboutClick());
    document.getElementById("about-note").addEventListener("click", () => this.onAboutCloseClick());
    window.addEventListener("hashchange", () => this.onHashChange());
    document.getElementById("container").addEventListener("click", (e) => this.onContainerClick(e));
  }

  onContainerClick(e) {
    if (!this.isMuted) return;
    // Don't unmute if clicking on interactive elements
    if (e.target.closest('#remote, #footer, #about-note')) return;
    this.unmute();
  }

  unmute() {
    if (!this.isMuted || !this.player) return;
    this.player.unMute();
    this.isMuted = false;
  }

  initializeFromHash() {
    const hash = window.location.hash.substring(1);
    const channelIndex = parseInt(hash, 10);
    if (!isNaN(channelIndex) && channelIndex >= 0 && channelIndex < this.playlist.channels.length) {
      this.changeChannelByIndex(channelIndex);
    } else {
      this.changeChannelByIndex(this.getRandomInt(0, this.playlist.channels.length - 1));
    }
    this.onResize();
  }

  onHashChange() {
    const hash = window.location.hash.substring(1);
    const channelIndex = parseInt(hash, 10);
    if (!isNaN(channelIndex) && channelIndex >= 0 && channelIndex < this.playlist.channels.length) {
      this.changeChannelByIndex(channelIndex);
    }
  }

  updateHash(index) {
    history.pushState(null, null, `#${index}`);
  }

  onFullscreenChange() {
    document.getElementById("container").classList.toggle("fullscreen");
  }

  onAboutClick() {
    document.getElementById("about-note").classList.toggle("show");
  }

  onAboutCloseClick() {
    document.getElementById("about-note").classList.remove("show");
  }

  showNoise() {
    clearTimeout(this.hideNoiseId);
    const noise = document.getElementById("noise");
    noise.style.visibility = "visible";
    noise.classList.add("visible");
  }

  hideNoise() {
    const noise = document.getElementById("noise");
    noise.classList.remove("visible");
    clearTimeout(this.hideNoiseId);
    this.hideNoiseId = setTimeout(() => {
      noise.style.visibility = "hidden";
    }, 400);
  }

  onPlayerStateChange(st) {
    switch (st.data) {
      case YT.PlayerState.ENDED:
        this.showNoise();
        this.nextVideo();
        break;
      case YT.PlayerState.PLAYING:
        this.hideNoise();
        break;
      case YT.PlayerState.BUFFERING:
        this.showNoise();
        break;
    }
  }

  onPlayerReady() {
    this.player.mute();
  }

  nextVideo() {
    const currentShow = this.getCurrentShow();
    if (!this.player) {
      this.createPlayer(currentShow);
    } else {
      this.player.loadVideoById(currentShow.show.id, currentShow.offset);
    }
    document.title = `betamaxmas - ${currentShow.show.title}`;
  }

  createPlayer(currentShow) {
    const screenElement = document.getElementById("screen");
    this.player = new YT.Player("screen", {
      width: screenElement.offsetWidth,
      height: screenElement.offsetHeight,
      videoId: currentShow.show.id,
      playerVars: {
        disablekb: 1,
        autoplay: 1,
        controls: 0,
        enablejsapi: 1,
        iv_load_policy: 3,
        modestbranding: 1,
        origin: document.location.hostname,
        playsinline: 1,
        rel: 0,
        showinfo: 0,
        start: currentShow.offset
      },
      events: {
        onReady: () => this.onPlayerReady(),
        onStateChange: (st) => this.onPlayerStateChange(st)
      }
    });
  }

  onVolumeUpClick() {
    const currentVolume = this.player.getVolume();
    this.player.setVolume(currentVolume + 10);
  }

  onVolumeDownClick() {
    const currentVolume = this.player.getVolume();
    this.player.setVolume(currentVolume - 10);
  }

  onChannelUpClick() {
    this.nextChannel();
  }

  onChannelDownClick() {
    this.prevChannel();
  }

  onFullscreenClick() {
    this.goFullscreen(document.getElementById("container"));
  }

  getCurrentShow() {
    const now = this.getPlaylistNow() % this.channel.duration;
    let showTime = 0;
    for (const show of this.channel.shows) {
      if (showTime + show.duration > now) {
        return { show, offset: now - showTime };
      }
      showTime += show.duration;
    }
  }

  changeChannelByIndex(index) {
    if (index === this.channelIndex) return;

    if (index >= this.playlist.channels.length) {
      index = 0;
    } else if (index < 0) {
      index = this.playlist.channels.length - 1;
    }

    this.channelIndex = index;
    this.channel = this.playlist.channels[this.channelIndex];
    document.getElementById("noise").classList.add("playing");

    this.updateHash(this.channelIndex);
    this.nextVideo();
  }

  nextChannel() {
    this.changeChannelByIndex(this.channelIndex + 1);
  }

  prevChannel() {
    this.changeChannelByIndex(this.channelIndex - 1);
  }

  onResize() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const ow = 600;
    const oh = 942;
    const oybuff = 50;
    const ovh = 291;
    const nw = Math.max(360, 0.4 * ww);
    const per = nw / ow;
    const nh = per * oh;
    const top = (wh - ovh * per) * 0.5 - oybuff * per - 100;
    const left = (ww - nw) * 0.5;

    const tvElements = document.querySelectorAll("#tv, #tvShadow");
    tvElements.forEach(el => {
      Object.assign(el.style, {
        width: `${nw}px`,
        height: `${nh}px`,
        left: `${left}px`,
        top: `${top}px`
      });
    });
  }

  goFullscreen(element) {
    element.requestFullscreen();
  }

  exitFullscreen() {
    document.exitFullscreen();
  }

  isFullscreen() {
    return screen.width === window.innerWidth && screen.height === window.innerHeight;
  }

  isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  getNow() {
    return Date.now();
  }

  getPlaylistNow() {
    return this.getNow() - this.startTime + this.playlist.time;
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}

// Initialize the application
const betamaxmas = new Betamaxmas();