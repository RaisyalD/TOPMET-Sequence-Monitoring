/* Explicit, offline importer: node scripts/import-data.js > seed.sql
 * It reads the repository's data.js and emits SQL only; it never contacts Supabase. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { timeout: 10000 });
const d = sandbox.window.TOPMET_DATA;
const q = v => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const json = v => q(JSON.stringify(v));
const ids = {};
const lines = ['-- Generated offline by scripts/import-data.js; review before applying.', 'begin;'];
Object.keys(d.meta).forEach(name => {
  const m = d.meta[name]; ids[name] = '00000000-0000-0000-0000-' + String(Object.keys(ids).length + 1).padStart(12, '0');
  lines.push(`insert into machines(id,name,display_name,recorded_on,status,rank) values (${q(ids[name])},${q(name)},${q(m.nama)},${q(m.tanggal)},${q(m.status)},${m.peringkat || 'null'}) on conflict(name) do nothing;`);
  lines.push(`insert into machine_scores(machine_id,score,status,rank) values (${q(ids[name])},${m.skor},${q(m.status)},${m.peringkat || 'null'}) on conflict(machine_id) do update set score=excluded.score,status=excluded.status,rank=excluded.rank;`);
});
Object.keys(d.data).forEach(name => Object.keys(d.data[name]).forEach(trialKey => {
  const trialId = '00000000-0000-0000-0001-' + String(lines.length).padStart(12, '0');
  const trial = d.data[name][trialKey], phase = (d.fase[name] || {})[trialKey] || {};
  lines.push(`insert into trials(id,machine_id,trial_key,phases,duration_seconds) values (${q(trialId)},${q(ids[name])},${q(trialKey)},${json(phase)},${trial.times[trial.times.length-1] || 0}) on conflict(machine_id,trial_key) do nothing;`);
  (trial.times || []).forEach(t => lines.push(`insert into sequence_samples(trial_id,time_seconds) values (${q(trialId)},${t}) on conflict do nothing;`));
  Object.keys(trial.komponen || {}).forEach(component => {
    const componentId = '00000000-0000-0000-0002-' + Buffer.from(component).toString('hex').slice(0, 12).padStart(12, '0');
    lines.push(`insert into components(id,name) values (${q(componentId)},${q(component)}) on conflict(name) do nothing;`);
    (trial.komponen[component] || []).forEach((state, i) => lines.push(`insert into component_states(trial_id,component_id,time_seconds,state) values (${q(trialId)},${q(componentId)},${trial.times[i] || 0},${!!state}) on conflict do nothing;`));
  });
  Object.keys(trial.tekanan || {}).forEach(channel => {
    const norm = channel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const channelId = '00000000-0000-0000-0003-' + Buffer.from(name + trialKey + norm).toString('hex').slice(0, 12).padStart(12, '0');
    lines.push(`insert into pressure_channels(id,trial_id,name,normalized_name) values (${q(channelId)},${q(trialId)},${q(channel)},${q(norm)}) on conflict(trial_id,normalized_name) do nothing;`);
    (trial.tekanan[channel] || []).forEach((value, i) => lines.push(`insert into pressure_samples(channel_id,time_seconds,value) values (${q(channelId)},${trial.times[i] || 0},${value == null ? 'null' : value}) on conflict do nothing;`));
  });
}));
lines.push('commit;');
console.log(lines.join('\n'));
