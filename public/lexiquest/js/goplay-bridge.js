/* GoPlay bridge — lets the migrated LexiQuest games use the SAME platform
   infrastructure as the native GoPlay games: a finished round is submitted to
   the `submit-score` Edge Function, which awards server-side points (these are
   free games, so no leaderboard). Uses the player's existing Supabase session
   (the portal is sign-in gated, so a session is present); silently no-ops if
   somehow signed out. Public URL + anon key only — security is the JWT + RLS. */
(function () {
  "use strict";
  var SUPABASE_URL = "https://aopmkdefqykctrxhflaq.supabase.co";
  var ANON_KEY = "sb_publishable_eUIQNW4yowiw2_USBKwGug_1UfmDXcV";
  var SESSION_KEY = "sb-aopmkdefqykctrxhflaq-auth-token";

  function accessToken() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.access_token) ||
        (s && s.currentSession && s.currentSession.access_token) || null;
    } catch (e) { return null; }
  }

  // Submit a finished round: awards points server-side (free game → no board).
  window.GoPlaySubmit = function (gameId, score, points) {
    var tok = accessToken();
    if (!tok) return;
    try {
      fetch(SUPABASE_URL + "/functions/v1/submit-score", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "apikey": ANON_KEY,
          "authorization": "Bearer " + tok,
        },
        body: JSON.stringify({
          gameId: String(gameId),
          score: Math.max(0, Math.floor(score || 0)),
          points: Math.max(0, Math.floor(points || 0)),
          leaderboard: false,
        }),
      }).catch(function () { /* network hiccup — ignore */ });
    } catch (e) { /* ignore */ }
  };
})();
