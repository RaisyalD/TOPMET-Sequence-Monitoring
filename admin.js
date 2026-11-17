(function () {
  'use strict';
  var client = window.TOPMET_SUPABASE;
  var cache = { machines: [], trials: [], samples: [], components: [], states: [], channels: [], pressures: [] };
  var selected = { trial: null };

  function setError(value) {
    var el = document.getElementById('adminError');
    var text = value && value.message ? value.message : String(value || '');
    el.textContent = text;
    if (text) showNotice(text, 'error');
  }
  function setSuccess(value) {
    document.getElementById('adminSuccess').textContent = value || '';
    if (value) showNotice(value, 'success');
  }
  var noticeTimer;
  function showNotice(text, type) {
    var toast = document.getElementById('noticeToast');
    var icon = document.getElementById('noticeIcon');
    document.getElementById('noticeText').textContent = text;
    toast.className = 'notice-toast show ' + (type || '');
    icon.textContent = type === 'error' ? '!' : type === 'success' ? '✓' : 'i';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { toast.classList.remove('show'); }, 3800);
  }
  function askConfirmation(text) {
    return new Promise(function (resolve) {
      var modal = document.getElementById('confirmModal');
      var confirmText = document.getElementById('confirmText');
      confirmText.textContent = text || 'Lanjutkan proses ini?';
      modal.hidden = false;
      function outsideClick(event) {
        if (event.target === modal) finish(false);
      }
      function escape(event) {
        if (event.key === 'Escape') finish(false);
      }
      function finish(answer) {
        modal.hidden = true;
        document.getElementById('confirmCancel').removeEventListener('click', cancel);
        document.getElementById('confirmAccept').removeEventListener('click', accept);
        modal.removeEventListener('click', outsideClick);
        document.removeEventListener('keydown', escape);
        resolve(answer);
      }
      function cancel() { finish(false); }
      function accept() { finish(true); }
      document.getElementById('confirmCancel').addEventListener('click', cancel);
      document.getElementById('confirmAccept').addEventListener('click', accept);
      document.getElementById('confirmAccept').focus();
      modal.addEventListener('click', outsideClick);
      document.addEventListener('keydown', escape);
    });
  }
  function fail(result) {
    if (result.error) throw result.error;
    return result.data || [];
  }
  function fill(select, rows, value, label) {
    select.innerHTML = '';
    if (!rows.length) {
      var empty = document.createElement('option');
      empty.textContent = 'Belum ada data';
      empty.disabled = true;
      empty.selected = true;
      select.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var option = document.createElement('option');
      option.value = row[value];
      option.textContent = label(row);
      select.appendChild(option);
    });
  }
  function selectedMachineId() {
    return document.getElementById('editMachine').value;
  }
  function selectedTrialKey() {
    return document.getElementById('editTrial').value;
  }
  function loadScoreForm() {
    return client.from('machine_scores').select('*').eq('machine_id', selectedMachineId()).maybeSingle().then(function (result) {
      if (result.error) throw result.error;
      var form = document.getElementById('scoreEditForm');
      var score = result.data || {};
      form.elements.score.value = score.score == null ? '' : score.score;
      form.elements.status.value = score.status || '';
      form.elements.rank.value = score.rank == null ? '' : score.rank;
    });
  }
  function loadMachines() {
    return client.from('machines').select('*').order('name').then(function (result) {
      cache.machines = fail(result);
      if (!cache.machines.length) {
        setSuccess('Data mesin belum ada. Menyiapkan baseline awal...');
        return seedBaseline();
      }
      fill(document.getElementById('editMachine'), cache.machines, 'id', function (m) {
        return m.display_name || m.name;
      });
      return client.from('trials').select('id').limit(1).then(function (trialResult) {
        if (trialResult.error) throw trialResult.error;
        if (!trialResult.data.length) {
          setSuccess('Trial belum tersedia. Menyiapkan baseline awal...');
          return seedBaseline();
        }
        return loadTrial();
      });
    });
  }
  function chunks(rows, size) {
    var output = [];
    for (var i = 0; i < rows.length; i += size) output.push(rows.slice(i, i + size));
    return output;
  }
  function insertBatches(table, rows) {
    return chunks(rows, 500).reduce(function (chain, batch) {
      return chain.then(function () {
        return client.from(table).insert(batch).then(function (result) {
          if (result.error) throw result.error;
        });
      });
    }, Promise.resolve());
  }
  function dateValue(value) {
    var parts = String(value || '').split('/');
    return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : null;
  }
  function seedBaseline() {
    var source = window.TOPMET_DATA;
    if (!source || !source.meta || !source.data) throw new Error('Data baseline lokal tidak tersedia.');
    setError('');
    setSuccess('Menyiapkan data baseline...');
    var machineRows = Object.keys(source.meta).map(function (name) {
      var meta = source.meta[name];
      return { name: name, display_name: meta.nama, recorded_on: dateValue(meta.tanggal), status: meta.status, rank: meta.peringkat };
    });
    return client.from('machines').upsert(machineRows, { onConflict: 'name' }).select('*').then(function (result) {
      var machines = fail(result);
      cache.machines = machines;
      var machineByName = {};
      machines.forEach(function (machine) { machineByName[machine.name] = machine; });
      var scores = machines.map(function (machine) {
        var meta = source.meta[machine.name];
        return { machine_id: machine.id, score: meta.skor, status: meta.status, rank: meta.peringkat };
      });
      var trials = [];
      machines.forEach(function (machine) {
        Object.keys(source.data[machine.name]).forEach(function (trialKey) {
          var data = source.data[machine.name][trialKey];
          trials.push({ machine_id: machine.id, trial_key: trialKey, phases: source.fase[machine.name][trialKey], duration_seconds: data.times[data.times.length - 1] });
        });
      });
      return client.from('machine_scores').upsert(scores, { onConflict: 'machine_id' }).then(function (scoreResult) {
        if (scoreResult.error) throw scoreResult.error;
        return client.from('trials').upsert(trials, { onConflict: 'machine_id,trial_key' }).select('*');
      });
    }).then(function (result) {
      var trials = fail(result);
      var componentsByName = {};
      Object.keys(source.data).forEach(function (machineName) {
        Object.keys(source.data[machineName]).forEach(function (trialKey) {
          Object.keys(source.data[machineName][trialKey].komponen).forEach(function (name) {
            componentsByName[name] = { name: name };
          });
        });
      });
      return client.from('components').upsert(Object.keys(componentsByName).map(function (name) {
        return componentsByName[name];
      }), { onConflict: 'name' }).select('*').then(function (componentResult) {
        var components = fail(componentResult);
        var componentByName = {};
        components.forEach(function (component) { componentByName[component.name] = component; });
        var trialRows = [], stateRows = [], channelRows = [], pressureRows = [];
        trials.forEach(function (trial) {
          var machine = cache.machines.filter(function (item) { return item.id === trial.machine_id; })[0];
          var machineData = source.data[machine.name][trial.trial_key];
          machineData.times.forEach(function (time) { trialRows.push({ trial_id: trial.id, time_seconds: time }); });
          Object.keys(machineData.komponen).forEach(function (name) {
            machineData.komponen[name].forEach(function (state, index) {
              stateRows.push({ trial_id: trial.id, component_id: componentByName[name].id, time_seconds: machineData.times[index], state: Boolean(state) });
            });
          });
          Object.keys(machineData.tekanan).forEach(function (name) {
            var channel = { trial_id: trial.id, name: name, normalized_name: window.TOPMET_DATA_SERVICE.normalizeChannel(name), unit: 'mbar' };
            channelRows.push(channel);
          });
        });
        return insertBatches('sequence_samples', trialRows).then(function () {
          return insertBatches('component_states', stateRows);
        }).then(function () {
          return client.from('pressure_channels').upsert(channelRows, { onConflict: 'trial_id,normalized_name' }).select('*');
        }).then(function (r) {
          var channels = fail(r);
          trials.forEach(function (trial) {
            var machine = cache.machines.filter(function (item) { return item.id === trial.machine_id; })[0];
            var machineData = source.data[machine.name][trial.trial_key];
            Object.keys(machineData.tekanan).forEach(function (name) {
              var channel = channels.filter(function (item) { return item.trial_id === trial.id && item.name === name; })[0];
              machineData.tekanan[name].forEach(function (value, index) {
                pressureRows.push({ channel_id: channel.id, time_seconds: machineData.times[index], value: value });
              });
            });
          });
          return insertBatches('pressure_samples', pressureRows);
        });
      });
    }).then(function () {
      setSuccess('Data baseline berhasil dimuat. Memuat ulang editor...');
      return loadMachines();
    }).catch(function (error) {
      setError(error);
      setSuccess('');
    });
  }
  function loadTrial() {
    var machineId = selectedMachineId();
    if (!machineId) return Promise.resolve();
    return client.from('trials').select('*').eq('machine_id', machineId).order('trial_key').then(function (result) {
      cache.trials = fail(result);
      var trialSelect = document.getElementById('editTrial');
      var requested = selectedTrialKey();
      var keys = cache.trials.map(function (trial) { return trial.trial_key; });
      fill(trialSelect, cache.trials, 'trial_key', function (trial) { return trial.trial_key === 'trial1' ? 'Trial 1' : 'Trial 2'; });
      if (keys.indexOf(requested) >= 0) trialSelect.value = requested;
      return loadEditorData();
    });
  }
  function loadEditorData() {
    var trial = cache.trials.filter(function (item) { return item.trial_key === selectedTrialKey(); })[0];
    selected.trial = trial;
    if (!trial) return Promise.resolve();
    return Promise.all([
      client.from('sequence_samples').select('*').eq('trial_id', trial.id).order('time_seconds'),
      client.from('components').select('*').order('name'),
      client.from('component_states').select('*').eq('trial_id', trial.id),
      client.from('pressure_channels').select('*').eq('trial_id', trial.id).order('name')
    ]).then(function (result) {
      cache.samples = fail(result[0]);
      cache.components = fail(result[1]);
      cache.states = fail(result[2]);
      cache.channels = fail(result[3]);
      var channelIds = cache.channels.map(function (channel) { return channel.id; });
      if (!channelIds.length) cache.pressures = [];
      else return client.from('pressure_samples').select('*').in('channel_id', channelIds).order('time_seconds').then(function (pressureResult) {
        cache.pressures = fail(pressureResult);
      });
    }).then(function () {
      fill(document.querySelector('#sequenceEditForm [name=sample_id]'), cache.samples, 'id', function (sample) { return sample.time_seconds + ' s'; });
      fill(document.querySelector('#sequenceEditForm [name=component_id]'), cache.components, 'id', function (component) { return component.name; });
      fill(document.querySelector('#pressureEditForm [name=sample_id]'), cache.pressures, 'time_seconds', function (sample) { return sample.time_seconds + ' s'; });
      fill(document.querySelector('#pressureEditForm [name=channel_id]'), cache.channels, 'id', function (channel) { return channel.name; });
      syncSequenceForm();
      syncPressureForm();
    });
  }
  function syncSequenceForm() {
    var form = document.getElementById('sequenceEditForm');
    var sample = cache.samples.filter(function (item) { return String(item.id) === form.elements.sample_id.value; })[0];
    if (!sample) return;
    form.elements.time_seconds.value = sample.time_seconds;
    var componentId = form.elements.component_id.value;
    var state = cache.states.filter(function (item) {
      return String(item.component_id) === componentId && Number(item.time_seconds) === Number(sample.time_seconds);
    })[0];
    form.elements.state.value = state && state.state ? 'true' : 'false';
  }
  function syncPressureForm() {
    var form = document.getElementById('pressureEditForm');
    var sample = cache.pressures.filter(function (item) { return String(item.time_seconds) === form.elements.sample_id.value; })[0];
    if (!sample) return;
    form.elements.time_seconds.value = sample.time_seconds;
    var channelId = form.elements.channel_id.value;
    var pressure = cache.pressures.filter(function (item) {
      return String(item.channel_id) === channelId && Number(item.time_seconds) === Number(sample.time_seconds);
    })[0];
    form.elements.value.value = pressure && pressure.value != null ? pressure.value : '';
  }
  function updateTime(oldTime, newTime) {
    if (Number(oldTime) === Number(newTime)) return Promise.resolve();
    var trialId = selected.trial.id;
    return client.from('sequence_samples').update({ time_seconds: Number(newTime) }).eq('id', document.querySelector('#sequenceEditForm [name=sample_id]').value).then(function (result) {
      if (result.error) throw result.error;
      return client.from('component_states').update({ time_seconds: Number(newTime) }).eq('trial_id', trialId).eq('time_seconds', Number(oldTime));
    }).then(function (result) {
      if (result.error) throw result.error;
      return client.from('pressure_samples').update({ time_seconds: Number(newTime) }).in('channel_id', cache.channels.map(function (c) { return c.id; })).eq('time_seconds', Number(oldTime));
    });
  }
  function saveSequence(event) {
    event.preventDefault();
    var form = event.target;
    var sample = cache.samples.filter(function (item) { return String(item.id) === form.elements.sample_id.value; })[0];
    if (!sample || !selected.trial) return;
    setError('');
    updateTime(sample.time_seconds, form.elements.time_seconds.value).then(function () {
      return client.from('component_states').update({ state: form.elements.state.value === 'true' })
        .eq('trial_id', selected.trial.id).eq('component_id', form.elements.component_id.value)
        .eq('time_seconds', Number(form.elements.time_seconds.value));
    }).then(function (result) {
      if (result.error) throw result.error;
      return loadEditorData();
    }).catch(setError);
  }
  function savePressure(event) {
    event.preventDefault();
    var form = event.target;
    var old = cache.pressures.filter(function (item) {
      return String(item.time_seconds) === form.elements.sample_id.value &&
        String(item.channel_id) === form.elements.channel_id.value;
    })[0];
    if (!old) return;
    setError('');
    client.from('pressure_samples').update({
      time_seconds: Number(form.elements.time_seconds.value),
      value: Number(form.elements.value.value)
    }).eq('channel_id', old.channel_id).eq('time_seconds', old.time_seconds).then(function (result) {
      if (result.error) throw result.error;
      return loadEditorData();
    }).catch(setError);
  }
  function saveScore(event) {
    event.preventDefault();
    var form = event.target;
    setError('');
    client.from('machine_scores').upsert({
      machine_id: selectedMachineId(),
      score: Number(form.elements.score.value),
      status: form.elements.status.value.trim() || null,
      rank: form.elements.rank.value ? Number(form.elements.rank.value) : null
    }).then(function (result) {
      if (result.error) throw result.error;
      return window.TOPMET_DATA_SERVICE.load();
    }).then(function (data) {
      window.TOPMET_DATA = data;
      window.location.reload();
    }).catch(setError);
  }
  window.TOPMET_ADMIN = {
    init: function () {
      if (!client || !document.getElementById('editMachine')) return;
      document.getElementById('seedBaselineButton').addEventListener('click', function () {
        askConfirmation('Muat seluruh data baseline Metz 1-4 ke Supabase sekarang? Data existing dengan key sama dapat menimbulkan duplikasi.').then(function (approved) {
          if (approved) {
            var button = document.getElementById('seedBaselineButton');
            button.disabled = true;
            button.textContent = 'Memuat baseline...';
            seedBaseline().then(function () {
              button.disabled = false;
              button.textContent = 'Muat Data Baseline';
            });
          }
        });
      });
      document.getElementById('editMachine').addEventListener('change', function () {
        loadTrial().then(function () {
          if (document.getElementById('editKind').value === 'score') return loadScoreForm();
        }).catch(setError);
      });
      document.getElementById('editTrial').addEventListener('change', loadEditorData);
      document.getElementById('editKind').addEventListener('change', function () {
        var sequence = this.value === 'sequence';
        var pressure = this.value === 'pressure';
        document.getElementById('sequenceEditor').hidden = !sequence;
        document.getElementById('pressureEditor').hidden = !pressure;
        document.getElementById('scoreEditor').hidden = this.value !== 'score';
        if (this.value === 'score') loadScoreForm().catch(setError);
      });
      document.querySelector('#sequenceEditForm [name=sample_id]').addEventListener('change', syncSequenceForm);
      document.querySelector('#sequenceEditForm [name=component_id]').addEventListener('change', syncSequenceForm);
      document.querySelector('#pressureEditForm [name=sample_id]').addEventListener('change', syncPressureForm);
      document.querySelector('#pressureEditForm [name=channel_id]').addEventListener('change', syncPressureForm);
      document.getElementById('sequenceEditForm').addEventListener('submit', saveSequence);
      document.getElementById('pressureEditForm').addEventListener('submit', savePressure);
      document.getElementById('scoreEditForm').addEventListener('submit', saveScore);
      loadMachines().catch(setError);
    }
  };
})();
