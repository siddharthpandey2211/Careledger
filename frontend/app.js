const guestNameInput = document.getElementById('guest-name-input');
const enterDemoBtn = document.getElementById('enter-demo-btn');
const scrollDetailsBtn = document.getElementById('scroll-details-btn');
const resetDemoBtn = document.getElementById('reset-demo-btn');
const dashboard = document.getElementById('dashboard');
const dashboardTitle = document.getElementById('dashboard-title');

const STORAGE_KEY = 'careledger_demo_name';

function getStoredName() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function saveName(name) {
  if (name) {
    localStorage.setItem(STORAGE_KEY, name);
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

function renderGreeting(name) {
  const displayName = name || 'Guest';
  dashboardTitle.textContent = `Welcome, ${displayName}`;
  dashboard.classList.remove('hidden');
}

function enterDemo() {
  const name = guestNameInput.value.trim();
  saveName(name);
  renderGreeting(name);
  dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetDemo() {
  saveName('');
  guestNameInput.value = '';
  dashboard.classList.add('hidden');
  dashboardTitle.textContent = 'Welcome';
}

guestNameInput.value = getStoredName();

if (guestNameInput.value) {
  renderGreeting(guestNameInput.value);
}

enterDemoBtn.addEventListener('click', enterDemo);

guestNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    enterDemo();
  }
});

if (scrollDetailsBtn) {
  scrollDetailsBtn.addEventListener('click', () => {
    document.getElementById('details').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (resetDemoBtn) {
  resetDemoBtn.addEventListener('click', resetDemo);
}
