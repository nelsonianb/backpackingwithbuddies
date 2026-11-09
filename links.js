// Opening a link from the game (the pause menu's suggestions form,
// scripts/autoload/trip_map.gd). Browsers only open a new tab during a tap or
// key press, and the game handles a press a frame later, so the game leaves
// the link here and letting go of the tap or key opens it.
(function () {
	var pending = null;
	window.bwbOpen = function (url) { pending = url; };
	function release() {
		if (!pending) return;
		var url = pending;
		pending = null;
		var tab = window.open(url, '_blank');
		if (!tab) location.href = url;  // no new tab allowed: go there (the game autosaves each screen)
	}
	['pointerup', 'touchend', 'mouseup', 'keyup'].forEach(function (t) {
		addEventListener(t, release, true);
	});
})();
