/* TOPMET Machine Monitoring Dashboard - app logic */
(function () {
  'use strict';
 
  var D = window.TOPMET_DATA;
  var META = D.meta, FASE = D.fase, DATA = D.data;

  var MACHINES = ['Metz1', 'Metz2', 'Metz3', 'Metz4'];
  var TRIALS = ['trial1', 'trial2'];
  var TRIAL_LABEL = { trial1: 'Trial 1', trial2: 'Trial 2' };
  var MCOLOR = { Metz1: '#60a5fa', Metz2: '#34d399', Metz3: '#f87171', Metz4: '#fbbf24' };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function fmt(v, d) { return v.toLocaleString('id-ID', { maximumFractionDigits: d == null ? 2 : d }); }
  function sci(v) {
    if (v == null || isNaN(v)) return '-';
    if (v === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(v)));
    var m = v / Math.pow(10, e);
    if (Math.abs(v) >= 1) return v.toFixed(v >= 100 ? 0 : 2);
    return m.toFixed(2) + 'E' + e;
  }
  function fmtTime(s) {
    if (s == null) return '-';
    var m = Math.floor(s / 60), sec = Math.round(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec + ' (' + Math.round(s) + 's)';
  }

  var charts = {};
  function mkChart(id, cfg) {
    var el = $(id);
    if (!el) return null;
    var canvas = el.querySelector('canvas');
    if (!canvas) { canvas = document.createElement('canvas'); el.appendChild(canvas); }
    if (charts[id]) { charts[id].destroy(); }
    charts[id] = new Chart(canvas, cfg);
    return charts[id];
  }

  Chart.defaults.color = '#7d8ea3';
  Chart.defaults.borderColor = 'rgba(42,58,78,.6)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;

  function logY(cfg) {
    cfg.options = cfg.options || {};
    cfg.options.scales = cfg.options.scales || {};
    var y = cfg.options.scales.y || (cfg.options.scales.y = {});
    y.type = 'logarithmic';
    y.title = { display: true, text: 'Tekanan (mbar)', color: '#7d8ea3' };
    y.ticks = y.ticks || {};
    y.ticks.callback = function (val) {
      if (val <= 0) return '';
      var e = Math.floor(Math.log10(val));
      var m = val / Math.pow(10, e);
      if (Math.abs(m - 1) < 1e-9) return '1E' + e;
      return m.toFixed(1) + 'E' + e;
    };
    return cfg;
  }

  // vacuum phase background plugin
  var phasePlugin = {
    id: 'phaseBg',
    beforeDraw: function (chart) {
      var opts = chart.options.plugins.phaseBg;
      if (!opts || !opts.fase) return;
      var x = chart.scales.x, y = chart.scales.y;
      if (!x || !y) return;
      var ctx = chart.ctx;
      var f = opts.fase;
      var bands = [
        [0, f.hv, 'rgba(125,142,163,0.07)', 'Low Vac'],
        [f.hv, f.heat, 'rgba(34,211,238,0.09)', 'High Vac'],
        [f.heat, f.end, 'rgba(251,146,60,0.09)', 'Heating']
      ];
      ctx.save();
      bands.forEach(function (b) {
        var x0 = x.getPixelForValue(b[0]), x1 = x.getPixelForValue(b[1]);
        var top = y.getPixelForValue(y.max !== undefined ? y.max : 1E3);
        var bot = y.getPixelForValue(y.min !== undefined ? y.min : 1E-5);
        ctx.fillStyle = b[2];
        ctx.fillRect(x0, top, x1 - x0, bot - top);
        ctx.fillStyle = 'rgba(125,142,163,0.5)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b[3], (x0 + x1) / 2, top + 12);
      });
      ctx.restore();
    }
  };
  Chart.register(phasePlugin);

  // shared line defaults w/ phase
  function trendCfg(labels, datasets, fase, spanGaps) {
    return phasePlugin ? null : null;
  }

  // ---------- populates ----------
  function fillSelect(sel, items, labelFn) {
    sel.innerHTML = '';
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it;
      o.textContent = labelFn ? labelFn(it) : it;
      sel.appendChild(o);
    });
  }

  function pressKey(machine, trial, which) {
    var tek = DATA[machine][trial].tekanan;
    var picks = {
      coating: ['Coating Chamber (mbar)', 'Press. Coating Ch. [cc] (mbar)'],
      winding: ['Winding Chamber (mbar)', 'Press. Winding Ch. [wc] (mbar)'],
      line: ['Line (mbar)', 'Press. Prevac Diff-Pumps [line] (mbar)'],
      diff: ['Diff Pump (mbar)']
    };
    for (var i = 0; i < picks[which].length; i++) {
      if (tek[picks[which][i]]) return picks[which][i];
    }
    return null;
  }

  function seriesFor(machine, trial, which) {
    var k = pressKey(machine, trial, which);
    if (!k) return null;
    return { key: k, vals: DATA[machine][trial].tekanan[k] };
  }

  // ---------- OVERVIEW ----------
  function renderKpi() {
    var grid = $('kpiGrid');
    grid.innerHTML = '';
    MACHINES.forEach(function (m) {
      var meta = META[m];
      var d = DATA[m].trial1;
      var coat = seriesFor(m, 'trial1', 'coating');
      var coatFinal = coat ? coat.vals[coat.vals.length - 1] : null;
      var line = seriesFor(m, 'trial1', 'line');
      var lineFinal = line ? line.vals[line.vals.length - 1] : null;
      var cls = meta.skor >= 80 ? 'kpi ok' : (meta.skor >= 50 ? 'kpi warn' : 'kpi bad');
      var statusCls = meta.skor >= 80 ? 'badge ok' : (meta.skor >= 50 ? 'badge warn' : 'badge bad');
      grid.insertAdjacentHTML('beforeend',
        '<div class="' + cls + '">' +
        '<div class="kpi-label">' + meta.nama + ' &middot; Peringkat ' + meta.peringkat + '</div>' +
        '<div class="kpi-value">' + fmt(meta.skor, 1) + ' <small style="font-size:12px;color:#7d8ea3">/ 100</small></div>' +
        '<div class="kpi-sub">' + sci(coatFinal) + ' mbar coating &middot; foreline ' + sci(lineFinal) + ' mbar</div>' +
        '<div style="margin-top:6px"><span class="badge ' + statusCls.split(' ')[1] + '">' + meta.status + '</span></div>' +
        '</div>');
    });
  }

  function renderOverviewCharts() {
    // ranking sorted by score desc
    var order = MACHINES.slice().sort(function (a, b) { return META[b].skor - META[a].skor; });
    mkChart('rankChart', {
      type: 'bar',
      data: {
        labels: order.map(function (m) { return META[m].nama; }),
        datasets: [{
          label: 'Skor Kesehatan',
          data: order.map(function (m) { return META[m].skor; }),
          backgroundColor: order.map(function (m) { return MCOLOR[m]; }),
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: 'Skor (0-100)' } } }
      }
    });

    // coating final
    var coatLabels = [], coatC = [], coatT = [];
    var target = 4e-4;
    MACHINES.forEach(function (m) {
      var s = seriesFor(m, 'trial1', 'coating');
      if (!s) return;
      var fin = s.vals.filter(function (v) { return v != null; });
      coatLabels.push(META[m].nama);
      coatC.push(fin[fin.length - 1]);
      var s2 = seriesFor(m, 'trial2', 'coating');
      var fin2 = s2 ? s2.vals.filter(function (v) { return v != null; }) : [];
      coatT.push(fin2.length ? fin2[fin2.length - 1] : null);
    });
    mkChart('coatingFinalChart', {
      type: 'bar',
      data: {
        labels: coatLabels,
        datasets: [
          { label: 'Trial 1', data: coatC, backgroundColor: MCOLOR.Metz1 === '#60a5fa' ? 'rgba(96,165,250,.75)' : 'rgba(96,165,250,.75)', borderRadius: 5 },
          { label: 'Trial 2', data: coatT, backgroundColor: 'rgba(34,211,238,.65)', borderRadius: 5 }
        ]
      },
      options: {
        plugins: {
          legend: { display: true, position: 'top' },
          annotation: null
        },
        scales: {
          y: {
            type: 'logarithmic', title: { display: true, text: 'mbar' },
            ticks: { callback: function (v) { if (v <= 0) return ''; var e = Math.floor(Math.log10(v)); var m = v / Math.pow(10, e); return (Math.abs(m - 1) < 1e-9 ? '1E' : m.toFixed(1) + 'E') + e; } }
          }
        }
      }
    });

    // custom target line via plugin (only active when options.plugins.targetLine set)
    var targetPlugin = {
      id: 'targetLine',
      beforeDraw: function (chart) {
        if (!chart.options.plugins || !chart.options.plugins.targetLine) return;
        var y = chart.scales.y;
        if (!y) return;
        var ctx = chart.ctx;
        var px = y.getPixelForValue(4e-4);
        ctx.save();
        ctx.strokeStyle = 'rgba(248,113,113,.8)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(chart.chartArea.left, px);
        ctx.lineTo(chart.chartArea.right, px);
        ctx.stroke();
        ctx.fillStyle = 'rgba(248,113,113,.9)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('target 4.0E-4', chart.chartArea.right - 95, px - 5);
        ctx.restore();
      }
    };
    Chart.register(targetPlugin);
    var c = charts['coatingFinalChart'];
    if (c) { c.options.plugins.targetLine = {}; c.update(); }
    charts.targetLinePlugin = targetPlugin;
    // ensure rendered with plugin by recreating with plugin in options
    mkChart('coatingFinalChart', {
      type: 'bar',
      data: {
        labels: coatLabels,
        datasets: [
          { label: 'Trial 1', data: coatC, backgroundColor: 'rgba(52,211,153,.8)', borderRadius: 5 },
          { label: 'Trial 2', data: coatT, backgroundColor: 'rgba(34,211,238,.7)', borderRadius: 5 }
        ]
      },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          y: {
            type: 'logarithmic', title: { display: true, text: 'mbar' },
            ticks: { callback: function (v) { if (v <= 0) return ''; var e = Math.floor(Math.log10(v)); var m = v / Math.pow(10, e); return (Math.abs(m - 1) < 1e-9 ? '1E' : m.toFixed(1) + 'E') + e; } }
          }
        }
      }
    });
    // re-register target line on this chart only
    var tc = charts['coatingFinalChart'];
    if (tc) {
      tc.options.plugins.targetLine = {};
      tc.update();
    }

    // time to 4e-4
    function timeTo4(m, trial) {
      var s = seriesFor(m, trial, 'coating');
      if (!s) return null;
      var t = DATA[m][trial].times;
      for (var i = 0; i < s.vals.length; i++) {
        if (s.vals[i] != null && s.vals[i] <= 4e-4) return t[i];
      }
      return null;
    }
    var t1 = MACHINES.map(function (m) { return timeTo4(m, 'trial1'); });
    var t2 = MACHINES.map(function (m) { return timeTo4(m, 'trial2'); });
    mkChart('time4e4Chart', {
      type: 'bar',
      data: {
        labels: MACHINES.map(function (m) { return META[m].nama; }),
        datasets: [
          { label: 'Trial 1 (s)', data: t1, backgroundColor: 'rgba(96,165,250,.8)', borderRadius: 5 },
          { label: 'Trial 2 (s)', data: t2, backgroundColor: 'rgba(34,211,238,.7)', borderRadius: 5 }
        ]
      },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: { y: { title: { display: true, text: 'detik' } } }
      }
    });

    // foreline
    var fl1 = [], fl2 = [];
    MACHINES.forEach(function (m) {
      var s1 = seriesFor(m, 'trial1', 'line');
      var a1 = s1 ? s1.vals.filter(function (v) { return v != null; }) : [];
      fl1.push(a1.length ? a1[a1.length - 1] : null);
      var s2 = seriesFor(m, 'trial2', 'line');
      var a2 = s2 ? s2.vals.filter(function (v) { return v != null; }) : [];
      fl2.push(a2.length ? a2[a2.length - 1] : null);
    });
    mkChart('forelineChart', {
      type: 'bar',
      data: {
        labels: MACHINES.map(function (m) { return META[m].nama; }),
        datasets: [
          { label: 'Trial 1', data: fl1, backgroundColor: 'rgba(251,191,36,.75)', borderRadius: 5 },
          { label: 'Trial 2', data: fl2, backgroundColor: 'rgba(251,146,60,.7)', borderRadius: 5 }
        ]
      },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: { y: { title: { display: true, text: 'mbar' } } }
      }
    });
  }

  // ---------- SEQUENCE ----------
  function keyComps(machine) {
    // komponen kunci yang ditampilkan di timeline
    var base = ['Valve Q2.1', 'Valve Q2.2', 'Valve Q1.1', 'Valve Q3.1', 'Valve Q3.2', 'Q4.1', 'Q4.3', 'Q2.3'];
    var comps = DATA[machine].trial1.komponen;
    var out = [];
    base.forEach(function (b) {
      Object.keys(comps).forEach(function (k) {
        if (k.indexOf(b) === 0 && out.indexOf(k) === -1) out.push(k);
      });
    });
    // pumps
    ['Roots Pump G21', 'Roots Pump G31', 'Roots Pump G32', 'Roots Pump G22', 'Diff Pump VD41', 'Diff Pump VD42', 'Diff Pump VD43', 'Diff Pump VD44', 'Roots Pump G11', 'Roots Pump G12', 'Roots Pump G13', 'Maxcool 1 (CC)', 'Maxcool 2 (WC)'].forEach(function (p) {
      if (comps[p] && out.indexOf(p) === -1) out.push(p);
    });
    return out;
  }

  function renderSeq() {
    var m = $('seqMachine').value, t = $('seqTrial').value;
    var d = DATA[m][t];
    var times = d.times;
    var end = times[times.length - 1];
    var comps = keyComps(m).filter(function (k) { return d.komponen[k]; });
    renderSeqTimeline(m, t, end);
    // duty cycle
    renderDuty();
  }

  function renderSeqTimeline(m, t, end) {
    var d = DATA[m][t];
    var f = d.fase;
    var wrap = $('seqChart');
    wrap.innerHTML = '';
    var phases = [
      { from: 0, to: f.hv, cls: 'ph-low', label: 'Low Vacuum' },
      { from: f.hv, to: f.heat, cls: 'ph-high', label: 'High Vacuum' },
      { from: f.heat, to: f.end, cls: 'ph-heat', label: 'Heating Boat' }
    ];
    var comps = keyComps(m).filter(function (k) { return d.komponen[k]; });
    var html = '<div class="seq-legend"><span class="lg-on"><i></i>ON / Aktif</span><span class="lg-off"><i></i>OFF / Non-aktif</span></div>';
    html += '<div class="seq-scale">';
    html += '<div class="seq-phases">';
    phases.forEach(function (p) {
      var l = (p.from / end) * 100, w = ((p.to - p.from) / end) * 100;
      html += '<div class="seq-phase ' + p.cls + '" style="left:' + l + '%;width:' + w + '%"><span>' + p.label + '</span></div>';
    });
    html += '</div>';
    html += '<div class="seq-ticks">';
    var step = end > 2500 ? 500 : (end > 1500 ? 300 : 200);
    for (var tt = 0; tt <= end + 1; tt += step) {
      html += '<span style="left:' + (tt / end) * 100 + '%">' + tt + 's</span>';
    }
    html += '</div></div>';
    html += '<div class="seq-rows">';
    comps.forEach(function (k) {
      var v = d.komponen[k];
      html += '<div class="seq-row"><span class="seq-label">' + k + '</span><div class="seq-track">';
      var prev = v[0], t0 = 0;
      // segmen per status
      var segs = [];
      for (var i = 0; i < v.length; i++) {
        var t1 = d.times[i];
        if (i > 0 && v[i] !== prev) {
          segs.push({ from: t0, to: t1, on: prev === 1 });
          t0 = t1;
          prev = v[i];
        }
      }
      segs.push({ from: t0, to: end, on: prev === 1 });
      segs.forEach(function (s) {
        var l = (s.from / end) * 100, w = ((s.to - s.from) / end) * 100;
        var cls = s.on ? 'seg-on' : 'seg-off';
        if (w < 0.15) return; // terlalu tipis, skip
        html += '<div class="seq-seg ' + cls + '" style="left:' + l + '%;width:' + w + '%"></div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  function renderDuty() {
    var m = $('dutyMachine').value, t = $('dutyTrial').value;
    var d = DATA[m][t];
    var comps = keyComps(m).filter(function (k) { return d.komponen[k]; });
    var labels = [], onp = [], tr = [];
    comps.forEach(function (k) {
      labels.push(k);
      var on = 0, prev = d.komponen[k][0], transitions = 0;
      for (var i = 0; i < d.komponen[k].length; i++) {
        if (d.komponen[k][i]) on += (i ? d.times[i] - d.times[i - 1] : 0);
        if (i && d.komponen[k][i] !== prev) transitions++;
        prev = d.komponen[k][i];
      }
      onp.push(Math.round(100 * on / d.times[d.times.length - 1]));
      tr.push(transitions);
    });
    mkChart('dutyChart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Duty cycle (%)', data: onp, backgroundColor: 'rgba(34,211,238,.75)', borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { max: 100, title: { display: true, text: '% waktu ON' } } }
      }
    });

    // transition table
    var tb = $('transitionTable');
    tb.innerHTML = '<thead><tr><th>Komponen</th><th>Aktif (s)</th><th>Duty (%)</th><th>Transisi</th></tr></thead><tbody>';
    comps.forEach(function (k, i) {
      tb.insertAdjacentHTML('beforeend',
        '<tr><td>' + k + '</td><td class="num">' + (onp[i] * d.times[d.times.length - 1] / 100).toFixed(0) + '</td><td class="num">' + onp[i] + '</td><td class="num">' + tr[i] + '</td></tr>');
    });
    tb.insertAdjacentHTML('beforeend', '</tbody>');
  }

  // ---------- PRESSURE ----------
  function renderPressure() {
    var m = $('presMachine').value, t = $('presTrial').value, which = $('presSeries').value;
    var d = DATA[m][t];
    var s = seriesFor(m, t, which);
    var labels = [], vals = [];
    if (s) {
      for (var i = 0; i < d.times.length; i++) {
        labels.push(d.times[i]);
        vals.push(s.vals[i]);
      }
    }
    var colorMap = { coating: '#34d399', winding: '#fbbf24', line: '#f87171', diff: '#a78bfa' };
    mkChart('presChart', logY({
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: META[m].nama + ' ' + TRIAL_LABEL[t] + ' - ' + which,
          data: vals,
          borderColor: colorMap[which],
          backgroundColor: colorMap[which] + '22',
          fill: true, tension: .25, pointRadius: 0, borderWidth: 2
        }]
      },
      options: {
        plugins: {
          legend: { display: true, position: 'top' },
          phaseBg: { fase: d.fase }
        },
        scales: { x: { title: { display: true, text: 'detik' } } }
      }
    }));

    // all machines coating profile
    renderPressureAll();
    renderPressureTable();
  }

  function renderPressureAll() {
    var t = $('presAllTrial').value;
    var labels = null, datasets = [];
    MACHINES.forEach(function (m) {
      var d = DATA[m][t];
      var s = seriesFor(m, t, 'coating');
      if (!s) return;
      if (!labels) labels = d.times;
      datasets.push({
        label: META[m].nama,
        data: s.vals,
        borderColor: MCOLOR[m],
        backgroundColor: MCOLOR[m] + '18',
        fill: false, tension: .2, pointRadius: 0, borderWidth: 1.8
      });
    });
    // target line via plugin
    mkChart('presAllChart', logY({
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: { x: { title: { display: true, text: 'detik' } } }
      }
    }));
    var c = charts['presAllChart'];
    if (c) { c.options.plugins.targetLine = {}; c.update(); }
  }

  function renderPressureTable() {
    var tb = $('pressureTable');
    tb.innerHTML = '<thead><tr><th>Parameter</th><th>Metz 1</th><th>Metz 2</th><th>Metz 3</th><th>Metz 4</th></tr></thead><tbody>';
    var rows = [
      ['Coating akhir (mbar)', 'coating', 'final'],
      ['Coating minimum (mbar)', 'coating', 'min'],
      ['Winding akhir (mbar)', 'winding', 'final'],
      ['Foreline akhir (mbar)', 'line', 'final'],
      ['Waktu ke 1.0E-3 (s)', 'coating', 't1e3'],
      ['Waktu ke 4.0E-4 (s)', 'coating', 't4e4']
    ];
    function val(m, which, kind) {
      var s = seriesFor(m, 'trial1', which);
      if (!s) return null;
      var arr = s.vals.filter(function (v) { return v != null; });
      if (!arr.length) return null;
      if (kind === 'final') return arr[arr.length - 1];
      if (kind === 'min') return Math.min.apply(null, arr);
      var d = DATA[m].trial1;
      var target = kind === 't1e3' ? 1e-3 : 4e-4;
      for (var i = 0; i < s.vals.length; i++) {
        if (s.vals[i] != null && s.vals[i] <= target) return d.times[i];
      }
      return null;
    }
    rows.forEach(function (r) {
      var name = r[0], which = r[1], kind = r[2];
      var cells = MACHINES.map(function (m) {
        var v = val(m, which, kind);
        if (v == null) return '<td>-</td>';
        if (kind === 'final' || kind === 'min') return '<td>' + sci(v) + '</td>';
        return '<td>' + Math.round(v) + '</td>';
      }).join('');
      tb.insertAdjacentHTML('beforeend', '<tr><td>' + name + '</td>' + cells + '</tr>');
    });
    tb.insertAdjacentHTML('beforeend', '</tbody>');
  }

  // ---------- TRIAL COMPARISON ----------
  function renderCmp() {
    var m = $('cmpMachine').value;
    var d1 = DATA[m].trial1, d2 = DATA[m].trial2;
    var f1 = FASE[m].trial1, f2 = FASE[m].trial2;
    var c1 = seriesFor(m, 'trial1', 'coating'), c2 = seriesFor(m, 'trial2', 'coating');
    var fin1 = c1 ? c1.vals.filter(function (v) { return v != null; }) : [];
    var fin2 = c2 ? c2.vals.filter(function (v) { return v != null; }) : [];
    var line1 = seriesFor(m, 'trial1', 'line'), line2 = seriesFor(m, 'trial2', 'line');
    var lf1 = line1 ? line1.vals.filter(function (v) { return v != null; }) : [];
    var lf2 = line2 ? line2.vals.filter(function (v) { return v != null; }) : [];
    function t4(d, c) {
      if (!c) return null;
      for (var i = 0; i < c.vals.length; i++) {
        if (c.vals[i] != null && c.vals[i] <= 4e-4) return d.times[i];
      }
      return null;
    }
    var dur1 = d1.times[d1.times.length - 1], dur2 = d2.times[d2.times.length - 1];
    $('cmpDurT1').textContent = fmtTime(dur1);
    $('cmpDurT2').textContent = fmtTime(dur2);
    $('cmpDurDelta').textContent = (dur2 - dur1 >= 0 ? '+' : '') + Math.round(dur2 - dur1) + ' s';
    $('cmpCoatT1').textContent = sci(fin1[fin1.length - 1]);
    $('cmpCoatT2').textContent = sci(fin2[fin2.length - 1]);
    $('cmpTimeT1').textContent = fmtTime(t4(d1, c1));
    $('cmpTimeT2').textContent = fmtTime(t4(d2, c2));
    $('cmpLineT1').textContent = sci(lf1[lf1.length - 1]);
    $('cmpLineT2').textContent = sci(lf2[lf2.length - 1]);

    // combined chart: coating both trials (x in seconds, aligned from 0)
    var labels = [];
    var maxT = Math.max(dur1, dur2);
    for (var i = 0; i <= maxT; i += 40) labels.push(i);
    var ds1 = [], ds2 = [];
    for (var i = 0; i < labels.length; i++) {
      ds1.push(c1 ? interp(c1, d1.times, labels[i]) : null);
      ds2.push(c2 ? interp(c2, d2.times, labels[i]) : null);
    }
    function interp(s, times, t) {
      for (var i = 0; i < times.length - 1; i++) {
        if (times[i] <= t && t <= times[i + 1]) {
          var a = s.vals[i], b = s.vals[i + 1];
          if (a == null) return b; if (b == null) return a;
          if (times[i + 1] === times[i]) return a;
          return a + (t - times[i]) * (b - a) / (times[i + 1] - times[i]);
        }
      }
      return null;
    }
    mkChart('cmpChart', logY({
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Trial 1', data: ds1, borderColor: '#60a5fa', backgroundColor: '#60a5fa18', fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
          { label: 'Trial 2', data: ds2, borderColor: '#22d3ee', backgroundColor: '#22d3ee18', fill: true, tension: .25, pointRadius: 0, borderWidth: 2 }
        ]
      },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: { x: { title: { display: true, text: 'detik' } } }
      }
    }));

    // transition comparison table
    var comps = keyComps(m);
    var tb = $('cmpTable');
    tb.innerHTML = '<thead><tr><th>Komponen / Fase</th><th>Trial 1</th><th>Trial 2</th><th>Δ</th></tr></thead><tbody>';
    function firstOn(d, k) {
      var v = d.komponen[k];
      if (!v) return null;
      for (var i = 0; i < v.length; i++) if (v[i]) return d.times[i];
      return null;
    }
    var rows = [['Fase High Vacuum', 'fase.hv'], ['Fase Heating', 'fase.heat'], ['Durasi total', 'dur']];
    function trVal(d, f, k) {
      if (k === 'dur') return d.times[d.times.length - 1];
      if (k === 'fase.hv') return f.hv;
      if (k === 'fase.heat') return f.heat;
      return firstOn(d, k);
    }
    comps.forEach(function (k) {
      if (['Valve Q2.1', 'Valve Q1.1', 'Roots Pump G31', 'Roots Pump G32', 'Diff Pump VD41'].indexOf(k) === -1) return;
      rows.push([k, 'comp:' + k]);
    });
    rows.forEach(function (r) {
      var name = r[0], kind = r[1];
      var v1 = kind.indexOf('comp:') === 0 ? trVal(d1, f1, kind.slice(5)) : trVal(d1, f1, kind);
      var v2 = kind.indexOf('comp:') === 0 ? trVal(d2, f2, kind.slice(5)) : trVal(d2, f2, kind);
      if (v1 == null && v2 == null) return;
      var s1 = v1 == null ? '-' : Math.round(v1) + ' s';
      var s2 = v2 == null ? '-' : Math.round(v2) + ' s';
      var dlt = (v1 != null && v2 != null) ? ((v2 - v1 >= 0 ? '+' : '') + Math.round(v2 - v1) + ' s') : '-';
      tb.insertAdjacentHTML('beforeend', '<tr><td>' + name + '</td><td>' + s1 + '</td><td>' + s2 + '</td><td>' + dlt + '</td></tr>');
    });
    tb.insertAdjacentHTML('beforeend', '</tbody>');
  }

  // ---------- PERFORMANCE ----------
  function renderPerformance() {
    // score chart
    mkChart('perfScoreChart', {
      type: 'bar',
      data: {
        labels: MACHINES.map(function (m) { return META[m].nama; }),
        datasets: [{
          label: 'Skor Kesehatan',
          data: MACHINES.map(function (m) { return META[m].skor; }),
          backgroundColor: MACHINES.map(function (m) { return MCOLOR[m]; }),
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Skor (0-100)' } } }
      }
    });

    // radar
    renderRadar();

    // verdicts
    renderVerdicts();
  }

  function normMetric(arr) {
    var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr);
    if (mx === mn) return arr.map(function () { return 0.5; });
    return arr.map(function (v) { return (v - mn) / (mx - mn); });
  }

  function renderRadar() {
    var m = $('radarMachine').value, t = $('radarTrial').value;
    var d = DATA[m][t];
    var s = seriesFor(m, t, 'coating');
    var coatArr = s ? s.vals.filter(function (v) { return v != null; }) : [];
    var times = d.times;
    function tTo(target) {
      if (!s) return null;
      for (var i = 0; i < s.vals.length; i++) if (s.vals[i] != null && s.vals[i] <= target) return times[i];
      return null;
    }
    // nilai per metrik, 1 = bagus
    var t100 = tTo(100) || times[times.length - 1];
    var t1e3 = tTo(1e-3);
    var t4e4 = tTo(4e-4) || times[times.length - 1];
    var coatFin = coatArr.length ? coatArr[coatArr.length - 1] : null;
    var lineS = seriesFor(m, t, 'line');
    var lineArr = lineS ? lineS.vals.filter(function (v) { return v != null; }) : [];
    var lineFin = lineArr.length ? lineArr[lineArr.length - 1] : null;
    var windS = seriesFor(m, t, 'winding');
    var windArr = windS ? windS.vals.filter(function (v) { return v != null; }) : [];
    var windFin = windArr.length ? windArr[windArr.length - 1] : null;
    // hitung skor orientasi "makin kecil makin baik" dibanding keempat mesin
    var allCoat = {}, allLine = {}, allWind = {};
    MACHINES.forEach(function (mm) {
      var ss = seriesFor(mm, 'trial1', 'coating');
      var aa = ss ? ss.vals.filter(function (v) { return v != null; }) : [];
      allCoat[mm] = aa.length ? aa[aa.length - 1] : null;
      var sl = seriesFor(mm, 'trial1', 'line');
      var al = sl ? sl.vals.filter(function (v) { return v != null; }) : [];
      allLine[mm] = al.length ? al[al.length - 1] : null;
      var sw = seriesFor(mm, 'trial1', 'winding');
      var aw = sw ? sw.vals.filter(function (v) { return v != null; }) : [];
      allWind[mm] = aw.length ? aw[aw.length - 1] : null;
    });
    function smallerBetter(v, map) {
      if (v == null) return 0;
      var keys = Object.keys(map).filter(function (k) { return map[k] != null; });
      var mx = Math.max.apply(null, keys.map(function (k) { return map[k]; }));
      var mn = Math.min.apply(null, keys.map(function (k) { return map[k]; }));
      if (mx === mn) return 0.5;
      return 1 - (v - mn) / (mx - mn);
    }
    var vals = [
      smallerBetter(coatFin, allCoat),
      smallerBetter(lineFin, allLine),
      smallerBetter(windFin, allWind),
      Math.max(0.05, 1 - t100 / 400),
      t1e3 != null ? Math.max(0.02, 1 - t1e3 / 3200) : 0.05
    ];
    var labelsR = ['Tekanan Coating', 'Foreline', 'Winding', 'Kecepatan Pumpdown', 'Waktu ke 1E-3'];
    mkChart('radarChartWrap', {
      type: 'radar',
      data: {
        labels: labelsR,
        datasets: [{
          label: META[m].nama + ' ' + TRIAL_LABEL[t],
          data: vals,
          borderColor: MCOLOR[m], backgroundColor: MCOLOR[m] + '33', pointBackgroundColor: MCOLOR[m]
        }]
      },
      options: {
        plugins: { legend: { display: true, position: 'top' } },
        scales: { r: { min: 0, max: 1, ticks: { stepSize: .25, callback: function (v) { return Math.round(v * 100) + '%'; } } } }
      }
    });
  }

  function renderVerdicts() {
    var box = $('perfVerdicts');
    var verdicts = [
      {
        m: 'Metz2', title: 'Metz 2 - Prima (Benchmark)',
        score: '95.1', badge: 'badge ok', points: [],
        rec: 'Jadikan acuan baseline. Lanjutkan maintenance preventif normal, simpan record ini sebagai pembanding audit.'
      },
      {
        m: 'Metz1', title: 'Metz 1 - Baik (Cepat & Stabil)',
        score: '92.2', badge: 'badge ok', points: [],
        rec: 'Pertahankan kondisi. Tidak ada tindakan darurat; jadikan pembanding untuk mesin lebih lambat.'
      },
      {
        m: 'Metz4', title: 'Metz 4 - Perlu Perhatian',
        score: '40.0', badge: 'badge warn', points: [],
        rec: 'Leak test sisi winding & seal roll, servis pompa kasar/booster (oli, filter, vanes), cek setpoint booster G31/G32 yang menyala 210 s lebih lambat, cek pemanas chamber.'
      },
      {
        m: 'Metz3', title: 'Metz 3 - Prioritas Maintenance',
        score: '10.2', badge: 'badge bad', points: [],
        rec: 'Prioritas 1: periksa jalur foreline & katup backing, ganti oli prevacuum, leak test foreline & sambungan pompa difusi, verifikasi valve Q1.1/Q2.2 di PLC, cek heater pompa difusi (lonjakan 760-770 s).'
      }
    ];
    var details = {
      Metz1: ['Kinerja pompa tercepat: 550 s ke 4.0E-4 mbar', 'Coating akhir 2.42E-4 mbar, di bawah target', 'Foreline 0.155 mbar, rendah dan stabil', 'Tanpa lonjakan tekanan >25%', 'Sekuensi valve normal (Q2.1 tutup 270 s, Q1.1 buka 440 s)'],
      Metz2: ['Coating akhir 2.20E-4 mbar, terbaik dari 4 mesin', 'Foreline 0.145 mbar, paling rendah', 'Winding 2.10E-2 mbar, paling rendah', 'Tanpa lonjakan tekanan >25%', 'Sekuensi valve/pompa normal, tanpa anomali trigger'],
      Metz3: ['Foreline menetap 0.28 mbar, tertinggi dari 4 mesin', 'Waktu ke 4.0E-4 hampir 3x Metz 2 (2960 s)', 'Tahap 0.2 ke 1.0E-2 paling lambat (1210 s)', '2 lonjakan tekanan di 760-770 s (0.020 ke 0.049 mbar)', 'Coating akhir 4.00E-4, tepat di batas target', 'Q1.1/Q2.2 belum tercatat membuka di file'],
      Metz4: ['Seluruh tahap paling lambat (260 s ke 100 mbar, 750 s ke 0.2 mbar)', 'Waktu total ke 4.0E-4 = 3060 s, siklus terpanjang', 'Winding akhir 5.2E-2 mbar, paling tinggi', 'Foreline 0.180 mbar, kedua tertinggi', 'Booster G31/G32 menyala 370 s, paling lambat (lainnya 160-210 s)']
    };
    var mName = { Metz1: 'Metz 1', Metz2: 'Metz 2', Metz3: 'Metz 3', Metz4: 'Metz 4' };
    box.innerHTML = '';
    verdicts.forEach(function (v) {
      var pts = details[v.m] || [];
      box.insertAdjacentHTML('beforeend',
        '<div class="verdict">' +
        '<div class="v-head"><span class="v-title">' + v.title + '</span>' +
        '<span class="v-score">' + v.score + ' / 100</span>' +
        '<span class="badge ' + v.badge + '">' + v.title.split(' - ')[1] + '</span></div>' +
        '<ul>' + pts.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
        '<p class="note">Rekomendasi: ' + v.rec + '</p></div>');
    });
  }

  // ---------- COMPONENT ----------
  function renderCompTable() {
    var m = $('compMachine').value, t = $('compTrial').value;
    var d = DATA[m][t];
    var comps = keyComps(m).filter(function (k) { return d.komponen[k]; });
    var dur = d.times[d.times.length - 1];
    var tb = $('compTable');
    tb.innerHTML = '<thead><tr><th>Komponen</th><th>Kategori</th><th>Duty (%)</th><th>Aktif (s)</th><th>Transisi</th><th>Status akhir</th></tr></thead><tbody>';
    comps.forEach(function (k) {
      var v = d.komponen[k];
      var on = 0, prev = v[0], tr = 0;
      for (var i = 0; i < v.length; i++) {
        if (v[i]) on += (i ? d.times[i] - d.times[i - 1] : 0);
        if (i && v[i] !== prev) tr++;
        prev = v[i];
      }
      var dur = d.times[d.times.length - 1];
      var pct = Math.round(100 * on / dur);
      var cat = k.indexOf('Valve') === 0 ? 'Valve' : (k.indexOf('Roots') === 0 ? 'Roots Pump' : (k.indexOf('Diff') === 0 ? 'Diffusion Pump' : 'Cooling'));
      var end = v[v.length - 1] ? 'ON' : 'OFF';
      var clsB = (k.indexOf('Diff') === 0 && end === 'ON') ? 'badge ok' : ((k.indexOf('Valve') === 0) ? (end === 'ON' ? 'badge warn' : 'badge ok') : (end === 'ON' ? 'badge ok' : 'badge warn'));
      tb.insertAdjacentHTML('beforeend',
        '<tr><td>' + k + '</td><td>' + cat + '</td><td class="num">' + pct + '</td><td class="num">' + fmt(on, 0) + '</td><td class="num">' + tr + '</td><td><span class="badge ' + clsB + '">' + end + '</span></td></tr>');
    });
    tb.insertAdjacentHTML('beforeend', '</tbody>');

    // duty chart
    mkChart('compDutyChart', {
      type: 'bar',
      data: {
        labels: comps,
        datasets: [{
          label: 'Duty cycle (%)',
          data: comps.map(function (k) {
            var v = d.komponen[k];
            var on = 0;
            for (var i = 0; i < v.length; i++) if (v[i]) on += (i ? d.times[i] - d.times[i - 1] : 0);
            return Math.round(100 * on / dur);
          }),
          backgroundColor: comps.map(function (k) { return k.indexOf('Valve') === 0 ? '#22d3ee' : (k.indexOf('Diff') === 0 ? '#a78bfa' : '#60a5fa'); }),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { max: 100, title: { display: true, text: '%' } } }
      }
    });

    renderHmi(m);
  }

  var HMI = {
    Metz1: {
      trial1: { rows: [['Evaporator no.', '16'], ['Tegangan evaporator (indiv.)', '10.0 V'], ['Tegangan evaporator (all)', '10.0 V'], ['Aluspeed (indiv.)', '895 mm/min'], ['Aluspeed (all)', '970 mm/min'], ['Meters', '43.635 m']], note: 'Gas ballast 20 min. Batas arus heater 13.0 A.' },
      trial2: { rows: [['Evaporator no.', '16'], ['Tegangan evaporator (indiv.)', '10.0 V'], ['Tegangan evaporator (all)', '10.0 V'], ['Aluspeed (indiv.)', '895 mm/min'], ['Aluspeed (all)', '970 mm/min'], ['Meters', '43.635 m']], note: 'Setpoint trigger sama dengan trial 1; perbedaan ada di timeline proses.' }
    },
    Metz2: {
      trial1: { rows: [['Evaporator no.', '10'], ['Tegangan evaporator (indiv.)', '9.3 V'], ['Tegangan evaporator (all)', '9.6 V'], ['Aluspeed (indiv.)', '915 mm/min'], ['Aluspeed (all)', '0 mm/min'], ['Meters', '61.167 m']], note: 'Aluspeed all 0 mm/min (proses sedang tidak berjalan). Batas arus heater 14.0 A.' },
      trial2: { rows: [['Evaporator no.', '10'], ['Tegangan evaporator (indiv.)', '9.3 V'], ['Tegangan evaporator (all)', '9.6 V'], ['Aluspeed (indiv.)', '915 mm/min'], ['Aluspeed (all)', '0 mm/min'], ['Meters', '61.167 m']], note: 'Setpoint trigger sama dengan trial 1.' }
    },
    Metz3: {
      trial1: { rows: [['Evaporator no.', '3'], ['Tegangan evaporator (indiv.)', '9.3 V'], ['Tegangan evaporator (all)', '9.3 V'], ['Aluspeed (indiv.)', '900 mm/min'], ['Aluspeed (all)', '0 mm/min'], ['Meters', '16.935 m']], note: 'Gauge VM15/VM21 1.0E+03 mbar, chamber belum tervakum saat foto.' },
      trial2: { rows: [['Evaporator no.', '3'], ['Tegangan evaporator (indiv.)', '9.3 V'], ['Tegangan evaporator (all)', '9.3 V'], ['Aluspeed (indiv.)', '900 mm/min'], ['Aluspeed (all)', '0 mm/min'], ['Meters', '16.935 m']], note: 'Setpoint trigger sama dengan trial 1.' }
    },
    Metz4: {
      trial1: { rows: [['Evaporator no.', 'tidak terbaca'], ['Tegangan evaporator (indiv.)', '9.1 V'], ['Tegangan evaporator (all)', '9.1 V'], ['Aluspeed (indiv.)', '1056 mm/min'], ['Aluspeed (all)', '1056 mm/min'], ['Meters', '38.318 m']], note: 'Foto agak buram; beberapa nilai estimasi.' },
      trial2: { rows: [['Evaporator no.', '15'], ['Tegangan evaporator (indiv.)', '8.7 V'], ['Tegangan evaporator (all)', '9.1 V'], ['Aluspeed (indiv.)', '1116 mm/min'], ['Aluspeed (all)', '1056 mm/min'], ['Meters', '38.818 m']], note: 'Tekanan live VM15 4.2E-3 mbar, VM21 3.7E-4 mbar.' }
    }
  };

  function renderHmi(m) {
    var tb = $('hmiTable');
    var t = $('compTrial').value;
    var h = (HMI[m] && HMI[m][t]) || { rows: [], note: '' };
    tb.innerHTML = '<thead><tr><th>Parameter</th><th>Nilai</th></tr></thead><tbody>';
    h.rows.forEach(function (r) {
      tb.insertAdjacentHTML('beforeend', '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td></tr>');
    });
    tb.insertAdjacentHTML('beforeend', '</tbody>');
    // hapus note lama lalu pasang ulang
    var card = tb.closest('.card');
    var oldNote = card ? card.querySelector('p.note') : null;
    if (oldNote) oldNote.remove();
    if (h.note) {
      var p = document.createElement('p');
      p.className = 'note';
      p.textContent = h.note;
      tb.insertAdjacentElement('afterend', p);
    }
  }

  // ---------- MAINTENANCE ----------
  function renderMaintenance() {
    var box = $('anomalyList');
    var items = [];

    function add(crit, title, msg, rec, machine) {
      items.push({ crit: crit, title: title, msg: msg, rec: rec, machine: machine });
    }

    // 1. Metz3 foreline (trial1 & trial2)
    add('crit', 'Foreline menetap tinggi (Metz 3)', 'Tekanan foreline/backing menetap di 0.28 mbar sepanjang siklus, tertinggi dari 4 mesin (trial 1 dan trial 2 sama). Nilai ini di atas Metz 2 (0.145) dan Metz 4 (0.180).', 'Prioritas 1: periksa jalur foreline, katup backing, dan sambungan pompa difusi. Ganti oli prevacuum dan cek filter/exhaust bila sudah waktunya. Lakukan leak test pada sisi foreline.', 'Metz3');
    // 2. Metz3 spike
    add('warn', 'Lonjakan tekanan coating (Metz 3)', '2 lonjakan tekanan di sekitar 760-770 s: coating chamber naik dari 2.0E-2 ke 3.8E-2 mbar (x1.9). Di trial 2 lonjakan serupa di 830 s (2.0E-2 ke 3.69E-2 mbar).', 'Cek suhu dan arus heater pompa difusi; lonjakan bisa berasal dari degassing atau beban backing berlebih sewaktu diff pump menyala.', 'Metz3');
    // 3. Metz3 valve not recorded
    add('warn', 'Valve Q1.1 / Q2.2 tidak tercatat membuka (Metz 3)', 'Pada file sequence Metz 3, Valve Q1.1 (main HV) dan Q2.2 (crossover) belum tercatat membuka. Pola ini berbeda dari Metz 1/2/4.', 'Verifikasi status valve di PLC/HMI: pastikan bukan error pembacaan atau masalah logika interlock. Perlu pengecekan langsung sebelum menyimpulkan kerusakan.', 'Metz3');
    // 4. Metz4 slow
    add('warn', 'Seluruh tahap vakum paling lambat (Metz 4)', 'Waktu ke 100 mbar = 260 s, ke 0.2 mbar = 750 s, total ke 4.0E-4 = 3060 s (siklus terpanjang). Booster tingkat 2 G31/G32 baru menyala di 370 s, paling lambat (mesin lain 160-210 s).', 'Leak test menyeluruh terutama sisi winding chamber & seal roll; servis pompa kasar dan booster (oli, filter, vanes); cek setpoint trigger booster G31/G32.', 'Metz4');
    // 5. Metz4 winding high
    add('warn', 'Tekanan winding chamber tertinggi (Metz 4)', 'Winding chamber akhir = 5.2E-2 mbar, tertinggi dari 4 mesin (Metz 1: 2.7E-2, Metz 2: 2.1E-2). Metz 3 mencatat 4.5E-4 tapi polanya berbeda (dua ruang tercampur pada file).', 'Periksa kebocoran sisi web, seal roll, dan sambungan winding chamber.', 'Metz4');
    // 6. Metz2 benchmark
    add('info', 'Metz 2 = benchmark terbaik', 'Coating akhir 2.20E-4 mbar, foreline 0.145 mbar, winding 2.10E-2 mbar, tanpa lonjakan tekanan. Skor kesehatan 95.1/100 (tertinggi).', 'Jadikan baseline pembanding untuk audit mesin lain dan evaluasi perbaikan.', 'Metz2');
    // 7. Metz1 good
    add('info', 'Metz 1 stabil dan cepat', 'Waktu ke 4.0E-4 = 550 s (tercepat), coating akhir 2.42E-4, tanpa lonjakan. Skor 92.2/100.', 'Tidak ada tindakan darurat; pertahankan interval maintenance preventif normal.', 'Metz1');
    // 8. Trial2 caveat
    add('info', 'Catatan data Trial 2', 'Trial 2 dibuat dari transformasi timeline (breakpoint fase) karena foto HMI trial 2 hanya memuat setpoint trigger, bukan waktu aktual. Tekanan akhir dan setpoint tidak berubah: Metz 1 2.42E-4, Metz 2 2.20E-4, Metz 3 4.0E-4, Metz 4 3.9E-4 mbar. Metz 4 adalah satu-satunya yang dipercepat (3060 ke 2800 s).', 'Perbarui dengan data HMI/trend recorder asli bila tersedia; analisis di dashboard memakai data tervalidasi yang ada.', 'Semua');

    box.innerHTML = '';
    items.forEach(function (it) {
      box.insertAdjacentHTML('beforeend',
        '<div class="anomaly ' + it.crit + '">' +
        '<div class="a-head"><span class="badge ' + (it.crit === 'crit' ? 'bad' : (it.crit === 'warn' ? 'warn' : 'ok')) + '">' + (it.crit === 'crit' ? 'KRITIS' : (it.crit === 'warn' ? 'PERHATIAN' : 'INFO')) + '</span>' +
        '<span class="a-title">' + it.title + '</span>' +
        '<span class="mini-label" style="text-transform:none">' + (it.machine === 'Semua' ? it.machine : it.machine.replace(/(Metz)(\d)/, '$1 $2')) + '</span></div>' +
        '<p class="a-msg">' + it.msg + '</p>' +
        '<p class="a-rec">' + it.rec + '</p>' +
        '</div>');
    });
  }

  // ---------- tabs ----------
  function initTabs() {
    var btns = document.querySelectorAll('.tab');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
        $('view-' + b.dataset.tab).classList.add('active');
        // refresh charts on show
        if (b.dataset.tab === 'overview') renderOverviewCharts();
        if (b.dataset.tab === 'sequence') renderSeq();
        if (b.dataset.tab === 'pressure') renderPressure();
        if (b.dataset.tab === 'trial') renderCmp();
        if (b.dataset.tab === 'performance') renderPerformance();
        if (b.dataset.tab === 'component') renderCompTable();
        if (b.dataset.tab === 'maintenance') renderMaintenance();
      });
    });
  }

  // ---------- init ----------
  function init() {
    // selects
    fillSelect($('seqMachine'), MACHINES, function (m) { return META[m].nama; });
    fillSelect($('dutyMachine'), MACHINES, function (m) { return META[m].nama; });
    fillSelect($('presMachine'), MACHINES, function (m) { return META[m].nama; });
    fillSelect($('cmpMachine'), MACHINES, function (m) { return META[m].nama; });
    fillSelect($('radarMachine'), MACHINES, function (m) { return META[m].nama; });
    fillSelect($('compMachine'), MACHINES, function (m) { return META[m].nama; });

    // events
    $('seqMachine').addEventListener('change', renderSeq);
    $('seqTrial').addEventListener('change', renderSeq);
    $('dutyMachine').addEventListener('change', renderDuty);
    $('dutyTrial').addEventListener('change', renderDuty);
    $('presMachine').addEventListener('change', renderPressure);
    $('presTrial').addEventListener('change', renderPressure);
    $('presSeries').addEventListener('change', renderPressure);
    $('presAllTrial').addEventListener('change', renderPressureAll);
    $('cmpMachine').addEventListener('change', renderCmp);
    $('radarMachine').addEventListener('change', renderRadar);
    $('radarTrial').addEventListener('change', renderRadar);
    $('compMachine').addEventListener('change', renderCompTable);
    $('compTrial').addEventListener('change', renderCompTable);

    // clock
    setInterval(function () {
      var n = new Date();
      $('clock').textContent = n.toLocaleTimeString('id-ID');
    }, 1000);

    initTabs();

    renderKpi();
    renderOverviewCharts();
    renderSeq();
    renderPressure();
    renderCmp();
    renderPerformance();
    renderCompTable();
    renderMaintenance();
  }

  document.addEventListener('DOMContentLoaded', init);
})();