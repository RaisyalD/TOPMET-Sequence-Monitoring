(function () {
  'use strict';
  var client = window.TOPMET_SUPABASE;
  var activeSessionId = null;
  var realtimeChannel = null;
  var dashboardStarted = false;
  function showError(error) {
    var status = document.querySelector('.status-pill');
    if (status) {
      status.classList.add('offline');
      status.innerHTML = '<span class="dot"></span> Database aktif · Realtime offline';
      status.title = error && error.message ? error.message : String(error);
    }
  }
  function showRealtimeConnected() {
    var status = document.querySelector('.status-pill');
    if (status) {
      status.classList.remove('offline');
      status.innerHTML = '<span class="dot"></span> Database &amp; Realtime aktif';
      status.removeAttribute('title');
    }
  }
  function enter(session) {
    if (!session || activeSessionId === session.access_token) return;
    activeSessionId = session.access_token;
    window.TOPMET_DATA_SERVICE.load().then(function (data) {
      window.TOPMET_DATA = data;
      if (!dashboardStarted) {
        window.TOPMET_startDashboard();
        dashboardStarted = true;
        if (window.TOPMET_ADMIN) window.TOPMET_ADMIN.init();
      }
      realtimeChannel = client.channel('topmet-live');
      realtimeChannel.on('postgres_changes', { event: '*', schema: 'public' }, function () {
        window.TOPMET_DATA_SERVICE.load().then(function (fresh) {
          window.TOPMET_DATA = fresh;
          window.location.reload();
        }).catch(showError);
      });
      realtimeChannel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') showRealtimeConnected();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          showError(new Error(status + '. Pastikan migration Realtime sudah dijalankan di Supabase.'));
        }
      });
    }).catch(showError);
  }
  if (!client) { window.location.replace('login.html'); return; }
  document.getElementById('logoutButton').addEventListener('click', function () {
    if (realtimeChannel) client.removeChannel(realtimeChannel);
    client.auth.signOut().then(function () { window.location.replace('login.html'); });
  });
  client.auth.getSession().then(function (result) {
    if (result.data.session) enter(result.data.session);
    else window.location.replace('login.html');
  }).catch(function () { window.location.replace('login.html'); });
})();
