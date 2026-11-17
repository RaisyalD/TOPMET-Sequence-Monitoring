(function () {
  'use strict';
  var client = window.TOPMET_SUPABASE;
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var message = document.getElementById('authMessage');
  function showError(error) {
    message.className = 'auth-error';
    message.textContent = error && error.message ? error.message : String(error);
  }
  function showSuccess(text) {
    message.className = 'auth-success';
    message.textContent = text;
  }
  if (!client) { showError(new Error('Supabase client tidak tersedia.')); return; }
  client.auth.getSession().then(function (result) {
    if (result.data.session) window.location.replace('index.html');
  });
  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      client.auth.signInWithPassword({
        email: loginForm.elements.email.value.trim(),
        password: loginForm.elements.password.value
      }).then(function (result) {
        if (result.error) throw result.error;
        window.location.replace('index.html');
      }).catch(showError);
    });
  }
  if (registerForm) {
    registerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (registerForm.elements.password.value !== registerForm.elements.confirm_password.value) {
        showError(new Error('Password dan konfirmasi password tidak sama.'));
        return;
      }
      client.auth.signUp({
        email: registerForm.elements.email.value.trim(),
        password: registerForm.elements.password.value
      }).then(function (result) {
        if (result.error) throw result.error;
        return client.auth.signOut();
      }).then(function () {
        showSuccess('Registrasi berhasil. Konfirmasi email jika diminta, lalu login.');
        registerForm.reset();
      }).catch(showError);
    });
  }
})();
