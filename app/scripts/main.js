var TVGuide = Class.extend({
	init: function(channelData) {
		this.channelData = channelData;
	}
});

var RemoteControl = Class.extend({
	init: function() {

	}
}); 

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
			this.startTime 	= this.getNow();
			console.log(playlist);
			this.injectYTScript();
		},

		//YOUTUBE - https://developers.google.com/youtube/iframe_api_reference
		injectYTScript: function() {
			window.onYouTubeIframeAPIReady = $.proxy(this.onYTPlayerReady, this);

			//Load iframe js
			var tag = document.createElement('script');
			tag.src = "https://www.youtube.com/iframe_api";
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		},
		onYTPlayerReady: function() {
			var randChannelIndex = this.getRandomInt(0, this.playlist.channels.length-1);
			this.changeChannelByIndex(randChannelIndex);
		},
		onPlayerReady: function() {
			console.log('onPlayerReady', arguments);
		},
		onPlayerStateChange: function(st) {

			console.log('onPlayerStateChange', st.data);
			switch(st.data) {
				case -1: //unstarted
				break;
				case 0: //ended
					this.nextVideo();
				break;
				case 1: //playing
					this.player.mute();
				break;
				case 2: //paused
				case 5:
				break;
				case 3: //buffering
				break;
			}
		},
		//Next video
		nextVideo: function() {
			var currentShow = this.getCurrentShow();
			if (!this.player) {
				this.player = new YT.Player('screen', {
					width:$('#screen').width(),
					height:$('#screen').height(),
					videoId:currentShow.show.id,
					playerVars:{
						disablekb:true,
						autoplay:1,
						controls:0,
						enablejsapi:true,
						iv_load_policy:3,
						modestbranding:1,
						origin:document.location.hostname,
						playsinline:1,
						rel:0,
						showinfo:0,
						start:currentShow.offset
					},
					events: {
						'onReady':$.proxy(this.onPlayerReady, this),
						'onStateChange':$.proxy(this.onPlayerStateChange, this)
					}
				});	
			} else {
				this.player.loadVideoById(currentShow.show.id, currentShow.offset);
			}
		},


		//CHANNELS
		getCurrentShow: function() {
			//Where are we at in the current channel playlist?
			var now = this.getPlaylistNow() % this.channel.duration,
			show,
			showIndex = 0,
			shows = this.channel.shows;
			while(now > 0) {
				show = shows[showIndex++];
				now -= show.duration;
			}

			return {
				show:show,
				offset:-now
			}
		},
		changeChannelByIndex: function(index) {
			//Where are we in the current playlist?
			if (index == this.channelIndex) {
				//Trying to change channels to the same channel.
				return;
			} else if (index >= this.playlist.channels.length) {
				//Wrapping back around to the beginning.
				index = 0;
			} else if (index < 0) {
				//Wrapping back around to the end.
				index = this.playlist.channels.length - 1;
			}

			//Set current channel.
			this.channelIndex 	= index;
			this.channel 		= this.playlist.channels[this.channelIndex];
			//console.log(this.channel.number);

			this.nextVideo();
			
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
			return (this.getNow() - this.startTime) + this.playlist.time;
		},
		getRandomInt: function(min, max) {
		  return Math.floor(Math.random() * (max - min)) + min;
		}
	}
)

b = new Betamaxmas();

