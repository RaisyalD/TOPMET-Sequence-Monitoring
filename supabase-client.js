(function () {
  'use strict';
  var cfg = window.TOPMET_SUPABASE_CONFIG;
  window.TOPMET_SUPABASE = window.supabase && cfg
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;
})();
