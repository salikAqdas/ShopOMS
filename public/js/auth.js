document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const messageEl = document.getElementById('loginMessage');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('name', data.name);
      localStorage.setItem('role', data.role);
      // Redirect to orders.html (or home page)
      window.location.href = '/orders.html';
    } else {
      messageEl.textContent = data.error || 'Login failed.';
    }
  } catch (error) {
    messageEl.textContent = 'Network error. Please try again.';
    console.error('Login failed:', error);
  }
});
