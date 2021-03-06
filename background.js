var Configs = {
	defaultConfigs: {
		"tweeturi": "off",
		"shortenuri": "bitly",
		"hashtag": "",
		"bitly_login" : "kentaro",
		"bitly_apiKey" : "R_3af5ffa1b78539a1d3df3c2a16edfb21",
	},
	obsoleteConfigs: [],
	save: function(configs) {
		var i, len = this.obsoleteConfigs.length;
		for (i=0; i<len; i++) {
			delete(configs[this.obsoleteConfigs[i]]);
		}
		localStorage["configs"] = JSON.stringify(configs);
	},
	load: function(forceDefault) {
		var configs = $.extend(true, {}, this.defaultConfigs);
		if (forceDefault) {
			return configs;
		}
		try {
			var stored = localStorage["configs"];
			if (stored !== undefined) {
				$.extend(true, configs, JSON.parse(stored));
			}
		} catch (e) {
			alert("Your configuration file is broken.\n\nPlease open the option page for reconfiguration.");
			delete localStorage["configs"];
		}
		return configs;
	},
	lyq: function() { return localStorage["mode"]; },
	setLyq: function(mode) {
		localStorage["mode"] = mode;
		updateIcon();
		if(mode === "on") {
			TwitterOAuth.prepareForTweet();
		}
	}
};

function shortenURI(uri) {
	// currently only Bit.ly is supported.
	var configs = Configs.load();
	var xhr = new XMLHttpRequest();
	var param = {"login": configs["bitly_login"],
				 "apiKey": configs["bitly_apiKey"],
				 "format": "json",
				 "longUrl": encodeURIComponent(uri)};
	var pairs = new Array();

	for (var key in param) {
		pairs.push(key + "=" + param[key]);
	}
	// should be asynchronous?
	xhr.open("GET", "http://api.bit.ly/v3/shorten?" + pairs.join("&"), false);
	xhr.send(null);
	if (xhr.status === 200) {
		try {
			var res = JSON.parse(xhr.responseText);
			if(res.data) {
				return res.data.url;
			}
		} catch (e) {
			console.log(e);
		}
	}
	return null;
}

// Tweet a message with or without shorten URI.
// * callback function will be called when the message is posted.
function tweet(msg, uri, callback) {
	var configs = Configs.load();
	var length;

	var hashtag = configs["hashtag"];
	if(hashtag) {
		msg += " #" + hashtag;
	}
	length = msg.length;
	if (configs["tweeturi"] === "on") {
		if (uri && uri !== "" && length < (140 - 22)) {
			msg += " " + shortenURI(uri);
		}
	}

	var update_url = "https://api.twitter.com/1.1/statuses/update.json";
	var sparams = TwitterOAuth.prepareSignedParams(update_url, {"status": msg}, "POST");

	$.ajax({
		"type": "POST",
		"url": update_url,
		"data": sparams,
		"dataType": "json",
		"timeout": 6000,
		"error": function (req, status, error) {
			// just logging and ignoring
			console.log(req.responseText);
			console.log(JSON.stringify(error));
		},
		"success": function(data, status) {
			if(callback) {
				callback(data);
			}
		},
	});
}

function updateIcon() {
	if (Configs.lyq() === "on") {
		chrome.browserAction.setTitle({title: "Lyqing"});
		chrome.browserAction.setIcon({path: "img/lyq-icon-open.png"});
	} else {
		chrome.browserAction.setTitle({title: "Not Lyqing"});
		chrome.browserAction.setIcon({path: "img/lyq-icon-close.png"});
	}
}

function signin(callback) {
	// callback when it is ready.
	TwitterOAuth.prepareForTweet(callback);
}

function signout() {
	TwitterOAuth.reset();
	Configs.setLyq("off");
}

function initLyq() {
	var configs = Configs.load();
	var disp = dispatcher();
	updateIcon();

	chrome.extension.onRequest.addListener(function(req, sender, resp) {
		switch(req["request"]) {
			case "lyq":
				resp(Configs.lyq());
				break;
			case "twitter_pin":
				TwitterOAuth.getAccessToken(req["pin"], function(result) {
					if(!result) {
						Configs.setLyq("off");
					}
					resp(result);
				});
				break;
			case "isAuthenticated":
				resp(TwitterOAuth.authenticated);
				break;
			default:
				disp.tweet(req);
				break;
		}
	});

	chrome.browserAction.onClicked.addListener(function() {
		if (Configs.lyq() === "on") {
			Configs.setLyq("off");
		} else {
			Configs.setLyq("on");
		}
	});
}

initLyq();
signin();
