

var Betamaxmas = Class.extend(
	{
		config: {
			dev: {
				playlistURL:'http://local/betamaxmas-data/'
			},
			prod:{

			}
		},
		init:function() {
			if (document.location.hostname.indexOf('local') > -1) {
				this.cfg = this.config['dev'];
			} else {
				this.cfg = this.config['prod'];
			}
			this.loadPlaylist();
		},
		
		//PLAYLIST
		loadPlaylist: function() {
			$.getJSON(this.cfg.playlistURL, $.proxy(this.onPlaylistLoaded, this));
			this.channel = Math.rand
		},
		onPlaylistLoaded: function(playlist) {
			this.playlist 	= playlist;
			this.startTime 	=  
			console.log(playlist);
			this.injectYTScript();
		},

		//YOUTUBE
		injectYTScript: function() {
			window.onYouTubeIframeAPIReady = $.proxy(this.onYouTubePlayerReady, this);

			//Load iframe js
			var tag = document.createElement('script');
			tag.src = "https://www.youtube.com/iframe_api";
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		},
		onYouTubePlayerReady: function() {
			var randChannelIndex = this.getRandomInt(0, this.playlist.channels.length-1);
			this.changeChannelByIndex(randChannelIndex);
		},


		//CHANNELS
		changeChannelByIndex: function(index) {
			//Where are we in the current playlist?
			if (index == this.channelIndex) {
				//Trying to change channels to the 
				return;
			} else if (index >= this.playlist.channels.length) {
				//Wrapping back around to the beginning.
				index = 0;
			} else if (index < 0) {
				//Wrapping back around to the end.
				index = this.playlist.channels.length - 1;
			}
			this.channelIndex 	= index;
			this.channel 		= this.playlist.channels[this.channelIndex];



		},
		nextChannel: function() {
			this.changeChannelByIndex(this.channelIndex + 1);
		},
		prevChannel: function() {
			this.changeChannelByIndex(this.channelIndex - 1);
		},


		//UTILITIES
		getNow: function() {
			return (new Date).getTime();
		},
		getPlaylistNow: function() {
			return this.getNow() + this.playlist.time;
		},
		getRandomInt: function(min, max) {
		  return Math.floor(Math.random() * (max - min)) + min;
		}
	}
)

b = new Betamaxmas();

