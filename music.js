// The songs, on the website (scripts/audio/song_player.gd talks to this).
// The browser's own audio player streams each song from music/ a few seconds at
// a time; Godot would unpack the whole song into memory first, and phones kill
// the page for that. Each player goes through a gain node: iPhones ignore an
// audio player's own volume.
(function () {
	var ctx = null;
	var spare = [];    // players a tap already started, so they can play later on their own
	var players = {};
	var next = 1;
	var silence = null;

	function context() {
		if (!ctx) {
			var AC = window.AudioContext || window.webkitAudioContext;
			ctx = new AC();
		}
		return ctx;
	}

	function make() {
		var el = new Audio();
		el.preload = 'auto';
		var gain = context().createGain();
		context().createMediaElementSource(el).connect(gain);
		gain.connect(context().destination);
		return { el: el, gain: gain, want: false, src: '' };
	}

	// A tenth of a second of nothing, as a WAV: what the first tap plays.
	function quiet() {
		var n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
		function s(at, t) { for (var i = 0; i < t.length; i++) v.setUint8(at + i, t.charCodeAt(i)); }
		s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
		v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
		v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
		v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
		return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
	}

	// Phones only let a page start sound inside a tap or key press. On each one:
	// wake the audio, start whatever's been waiting, and (the first time) start a
	// few spare players so later songs can begin without one.
	function tap() {
		var c = context();
		if (c.state !== 'running') c.resume();
		for (var id in players) {
			var p = players[id];
			if (p.want && p.el.paused && p.src) p.el.play().catch(function () {});
		}
		if (silence === null) {
			silence = quiet();
			for (var i = 0; i < 3; i++) {
				var q = make();
				q.el.src = silence;
				q.el.play().catch(function () {});
				spare.push(q);
			}
		}
	}
	['pointerdown', 'touchend', 'mousedown', 'keydown'].forEach(function (t) {
		addEventListener(t, tap, true);
	});

	// The page in the background: stop the music; back: carry on.
	document.addEventListener('visibilitychange', function () {
		for (var id in players) {
			var p = players[id];
			if (document.hidden) p.el.pause();
			else if (p.want && p.src) p.el.play().catch(function () {});
		}
	});

	window.bwbMusic = {
		open: function () {
			var p = spare.pop() || make();
			p.el.pause();
			p.want = false;
			p.src = '';
			p.gain.gain.value = 0;
			players[next] = p;
			return next++;
		},
		play: function (id, url, from, loop) {
			var p = players[id];
			if (!p) return;
			var el = p.el;
			el.loop = !!loop;
			p.want = true;
			if (p.src !== url) {
				p.src = url;
				el.src = url;
			}
			var go = function () {
				if (!p.want || p.src !== url) return;
				var d = el.duration;
				try { el.currentTime = (d && isFinite(d)) ? from % d : from; } catch (e) {}
				if (!document.hidden) el.play().catch(function () {});
			};
			if (el.readyState >= 1) go();
			else el.addEventListener('loadedmetadata', go, { once: true });
		},
		stop: function (id) {
			var p = players[id];
			if (!p) return;
			p.want = false;
			p.el.pause();
		},
		seek: function (id, to) {
			var p = players[id];
			if (p && p.el.readyState >= 1) p.el.currentTime = Math.max(0, to);
		},
		gain: function (id, g) {
			var p = players[id];
			if (p) p.gain.gain.value = g;
		},
		position: function (id) {
			var p = players[id];
			return p ? p.el.currentTime : 0;
		},
		duration: function (id) {
			var p = players[id];
			var d = p ? p.el.duration : 0;
			return d && isFinite(d) ? d : 0;
		},
		playing: function (id) {
			var p = players[id];
			return !!p && p.want && !p.el.ended;
		},
		close: function (id) {
			var p = players[id];
			if (!p) return;
			delete players[id];
			p.want = false;
			p.el.pause();
			p.el.removeAttribute('src');
			p.el.load();
			p.src = '';
			p.gain.gain.value = 0;
			spare.push(p);
		},
	};
})();
