const setupAuthForm = ({ formId, endpoint, errorId }) => {
  const form = document.getElementById(formId);
  const errorEl = document.getElementById(errorId);

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.add('hidden');

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Please wait...';

    const formData = new FormData(form);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(formData.get('email') || '').trim().toLowerCase(),
          password: formData.get('password'),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showError(data.message || 'Authentication failed');
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        return;
      }

      if (!data.token || !data.email) {
        showError('Login succeeded but the server returned an invalid response.');
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('email', data.email);
      window.location.href = '/';
    } catch (error) {
      showError('Could not reach the server. Please try again.');
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
};

window.setupAuthForm = setupAuthForm;
