(function () {
  'use strict';
  var client = window.TOPMET_SUPABASE;
  function local() { return window.TOPMET_DATA; }
  function key(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function normalized(rows) {
    var out = { meta: {}, fase: {}, data: {} }, machines = {};
    (rows.machines || []).forEach(function (m) {
      machines[m.id] = m; out.meta[m.name] = { nama: m.display_name || m.name, tanggal: m.recorded_on || '', skor: 0, status: m.status || '', peringkat: m.rank || 0 };
      out.fase[m.name] = {}; out.data[m.name] = {};
    });
    (rows.scores || []).forEach(function (s) { var m = machines[s.machine_id]; if (m && out.meta[m.name]) Object.assign(out.meta[m.name], { skor: Number(s.score) || 0, status: s.status || out.meta[m.name].status, peringkat: s.rank || 0 }); });
    (rows.trials || []).forEach(function (t) {
      var m = machines[t.machine_id]; if (!m) return;
      var name = m.name, times = (rows.samples || []).filter(function (x) { return x.trial_id === t.id; }).sort(function (a,b) { return a.time_seconds-b.time_seconds; }).map(function (x) { return Number(x.time_seconds); });
      out.fase[name][t.trial_key] = t.phases || { hv: 0, heat: 0, end: t.duration_seconds || 0 };
      var d = { times: times, komponen: {}, tekanan: {} };
      (rows.states || []).filter(function (x) { return x.trial_id === t.id; }).sort(function (a, b) {
        return Number(a.time_seconds) - Number(b.time_seconds);
      }).forEach(function (x) { (d.komponen[x.component_name] = d.komponen[x.component_name] || []).push(x.state ? 1 : 0); });
      (rows.pressure || []).filter(function (x) { return x.trial_id === t.id; }).forEach(function (x) { d.tekanan[x.name] = x.values; });
      out.data[name][t.trial_key] = d;
    });
    return out;
  }
  function load() {
    if (!client) return Promise.resolve(local());
    return Promise.all(['machines','trials','sequence_samples','pressure_channels','machine_scores'].map(function (table) { return client.from(table).select('*'); }))
      .then(function (r) {
        if (r.some(function (x) { return x.error; }) ||
            !r[0].data || !r[0].data.length ||
            !r[1].data || !r[1].data.length ||
            !r[2].data || !r[2].data.length ||
            !r[3].data || !r[3].data.length) return local();
        var machines = r[0].data, trials = r[1].data, samples = r[2].data, channels = r[3].data;
        return Promise.all([client.from('component_states').select('*, components(name)'), client.from('pressure_samples').select('*')]).then(function (extra) {
          if (extra.some(function (x) { return x.error; }) || !extra[0].data.length || !extra[1].data.length) return local();
          var pressure = channels.map(function (c) { return { trial_id: c.trial_id, name: c.name, values: extra[1].data.filter(function (p) { return p.channel_id === c.id; }).sort(function(a,b){return a.time_seconds-b.time_seconds;}).map(function(p){return p.value;}) }; });
          var states = (extra[0].data || []).map(function (s) { return { trial_id: s.trial_id, component_name: s.components && s.components.name, time_seconds: s.time_seconds, state: s.state }; });
          return normalized({ machines: machines, trials: trials, samples: samples, scores: r[4].data || [], pressure: pressure, states: states });
        });
      });
  }
  function crud(table, method, values, id) {
    if (!client) return Promise.reject(new Error('Supabase belum dikonfigurasi.'));
    var q = client.from(table);
    if (method === 'insert') return q.insert(values).select().single();
    if (method === 'update') return q.update(values).eq('id', id).select().single();
    return q.delete().eq('id', id);
  }
  window.TOPMET_DATA_SERVICE = { load: load, normalized: normalized, create: function(t,v){return crud(t,'insert',v);}, update: function(t,id,v){return crud(t,'update',v,id);}, remove: function(t,id){return crud(t,'delete',null,id);}, normalizeChannel: key };
})();
