const output = document.getElementById('output');
const apiBaseInput = document.getElementById('api-base');
const healthUrlInput = document.getElementById('health-url');
const tokenInput = document.getElementById('token-input');
const authPill = document.getElementById('auth-state-pill');
const authPanel = document.getElementById('auth-panel');
const workspaceHeaderMenu = document.getElementById('workspace-header-menu');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const showSignupBtn = document.getElementById('show-signup-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const savedSessionRow = document.getElementById('saved-session-row');
const useSavedSessionBtn = document.getElementById('use-saved-session-btn');
const workspaceButtons = Array.from(document.querySelectorAll('[data-workspace]'));
const workspaceSections = Array.from(document.querySelectorAll('[data-workspace-panel]'));
const patientMenuActionButtons = Array.from(document.querySelectorAll('.patient-menu-action'));
let syncPatientProfileState = null;
let syncDoctorProfileState = null;
let tokenConfirmed = false;
const ALL_WORKSPACES = ['connection', 'patient', 'doctor', 'consultations', 'clinics', 'medications', 'admin'];
const GUEST_ROLE = 'doctor';

const TOKEN_KEY = 'careledger_token';
const DEFAULT_WORKSPACE = 'connection';
const ROLE_WORKSPACES = {
  patient: ['connection', 'patient'],
  doctor: ['connection', 'doctor', 'consultations', 'clinics', 'medications'],
  admin: ['connection', 'admin'],
};

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function writeOutput(title, data) {
  const now = new Date().toLocaleString();
  output.textContent = `[${now}] ${title}\n\n${typeof data === 'string' ? data : pretty(data)}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  tokenInput.value = token;
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  tokenInput.value = '';
}

function cleanBody(body) {
  const cleaned = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

function formToObject(form) {
  return cleanBody(Object.fromEntries(new FormData(form).entries()));
}

function parseTokenPayload(token) {
  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) {
      return null;
    }

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function createGuestToken(role = GUEST_ROLE) {
  const payload = btoa(JSON.stringify({ userId: 'guest', role, email: null, phone: null }));
  return `eyJhbGciOiJub25lIn0.${payload}.`;
}

function getCurrentRole() {
  return parseTokenPayload(getToken().trim())?.role || '';
}

function getCurrentUserId() {
  return parseTokenPayload(getToken().trim())?.userId || '';
}

async function request(path, method, body) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `local:${normalizedPath}`;

  const success = (status, data, message) => ({
    status,
    ok: status >= 200 && status < 300,
    method,
    url,
    response: {
      success: status >= 200 && status < 300,
      data,
      message,
    },
  });

  if (normalizedPath === '/users/signup' && method === 'POST') {
    return success(201, { email: body?.email || '', phone: body?.phone || '', role: body?.role || GUEST_ROLE }, 'User created successfully');
  }

  if (normalizedPath === '/users/login' && method === 'POST') {
    return success(200, { token: createGuestToken(body?.role || GUEST_ROLE) }, 'Login successful');
  }

  if (normalizedPath === '/health') {
    return success(200, { ok: true }, 'Static site is running.');
  }

  if (normalizedPath === '/patients' && method === 'GET') {
    return success(200, {
      id: 'guest-patient',
      full_name: 'Guest Patient',
      health_id: 'CL-GUEST-0001',
      date_of_birth: null,
      gender: 'other',
      blood_group: 'O+',
      email: 'guest@careledger.local',
      phone: '0000000000',
    }, 'Operation successful.');
  }

  if (normalizedPath === '/doctors' && method === 'GET') {
    return success(200, {
      id: 'guest-doctor',
      full_name: 'Guest Doctor',
      license_number: 'GUEST-0001',
      specialization: 'General Medicine',
      is_verified: true,
      email: 'guest@careledger.local',
      phone: '0000000000',
    }, 'Operation successful.');
  }

  if (normalizedPath === '/patients/consultations' || normalizedPath === '/patients/access-list' || normalizedPath === '/clinics' || normalizedPath === '/medications') {
    return success(200, [], 'Operation successful.');
  }

  if (normalizedPath.startsWith('/consultations') || normalizedPath.startsWith('/doctors') || normalizedPath.startsWith('/patients') || normalizedPath.startsWith('/clinics') || normalizedPath.startsWith('/medications') || normalizedPath.startsWith('/admin')) {
    return success(200, body || null, 'Operation successful.');
  }

  return success(200, body || null, 'Operation successful.');
}

async function checkServerHealth() {
  try {
    const result = await request('/health', 'GET');
    writeOutput('Server health response', result);
  } catch (err) {
    writeOutput('Server health error', err.message);
  }
}

function showWorkspace(name) {
  let workspaceName = name || DEFAULT_WORKSPACE;

  if (!tokenConfirmed && workspaceName !== 'connection') {
    workspaceName = 'connection';
  }

  workspaceSections.forEach((section) => {
    section.classList.toggle('hidden', section.dataset.workspacePanel !== workspaceName);
  });

  workspaceButtons.forEach((button) => {
    const isActive = button.dataset.workspace === workspaceName;
    button.classList.toggle('ghost', !isActive);
    button.classList.toggle('active', isActive);
  });

  if (workspaceName === 'patient' && typeof syncPatientProfileState === 'function') {
    syncPatientProfileState();
  }

  if (workspaceName === 'doctor' && typeof syncDoctorProfileState === 'function') {
    syncDoctorProfileState();
  }
}

function defaultWorkspaceForRole(role) {
  if (role === 'doctor') {
    return 'doctor';
  }

  if (role === 'admin') {
    return 'admin';
  }

  return role === 'patient' ? 'patient' : DEFAULT_WORKSPACE;
}

function secondWorkspaceForRole(role) {
  const allowed = ROLE_WORKSPACES[role] || [];
  if (allowed.length >= 2) {
    return allowed[1];
  }
  return allowed[0] || DEFAULT_WORKSPACE;
}

function applyMenuByRole(role) {
  const allowed = ROLE_WORKSPACES[role] || [];

  workspaceButtons.forEach((button) => {
    const workspace = button.dataset.workspace;
    const visible = tokenConfirmed ? allowed.includes(workspace) : workspace === 'connection';
    button.classList.toggle('hidden', !visible);
  });

  const showPatientActions = tokenConfirmed && role === 'patient';
  patientMenuActionButtons.forEach((button) => {
    button.classList.toggle('hidden', !showPatientActions);
  });
}

function setAuthState(isAuthenticated) {
  const role = getCurrentRole();

  if (isAuthenticated) {
    authPill.classList.add('ready');
    authPill.textContent = role ? `Auth: Logged in (${role})` : 'Auth: Logged in';
    authPanel.classList.add('hidden');
    workspaceHeaderMenu.classList.remove('hidden');
    applyMenuByRole(role);
    showWorkspace(tokenConfirmed ? defaultWorkspaceForRole(role) : 'connection');
  } else {
    authPill.classList.remove('ready');
    authPill.textContent = 'Auth: Required';
    authPanel.classList.remove('hidden');
    workspaceHeaderMenu.classList.add('hidden');
    workspaceButtons.forEach((button) => button.classList.remove('hidden'));
    patientMenuActionButtons.forEach((button) => button.classList.add('hidden'));
    workspaceSections.forEach((section) => section.classList.add('hidden'));
  }
}

function updateSavedSessionPrompt() {
  if (!savedSessionRow) {
    return;
  }

  savedSessionRow.classList.toggle('hidden', !getToken().trim());
}

function showAuthForm(mode) {
  const signupMode = mode === 'signup';
  signupForm.classList.toggle('hidden', !signupMode);
  loginForm.classList.toggle('hidden', signupMode);
  showSignupBtn.classList.toggle('ghost', !signupMode);
  showLoginBtn.classList.toggle('ghost', signupMode);
}

function bindForm(formId, title, path, method, transform) {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const transformed = transform ? transform(formToObject(form), form) : formToObject(form);
      const requestPath = transformed && typeof transformed === 'object' && Object.prototype.hasOwnProperty.call(transformed, 'path')
        ? transformed.path
        : path;
      const body = transformed && typeof transformed === 'object' && Object.prototype.hasOwnProperty.call(transformed, 'body')
        ? transformed.body
        : transformed;
      const result = await request(requestPath, method, body);
      writeOutput(title, result);
    } catch (err) {
      writeOutput(`${title} error`, err.message);
    }
  });
}

function bindClick(id, handler) {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener('click', handler);
  }
}

function initAuth() {
  showAuthForm('signup');
  updateSavedSessionPrompt();

  const loginWithSelect = document.getElementById('login-with');
  const loginEmailInput = document.getElementById('login-email-input');
  const loginPhoneInput = document.getElementById('login-phone-input');

  const applyLoginMode = () => {
    const mode = loginWithSelect.value;
    const emailMode = mode === 'email';

    loginEmailInput.classList.toggle('hidden', !emailMode);
    loginEmailInput.disabled = !emailMode;
    loginEmailInput.required = emailMode;

    loginPhoneInput.classList.toggle('hidden', emailMode);
    loginPhoneInput.disabled = emailMode;
    loginPhoneInput.required = !emailMode;
  };

  applyLoginMode();
  loginWithSelect.addEventListener('change', applyLoginMode);

  showSignupBtn.addEventListener('click', () => showAuthForm('signup'));
  showLoginBtn.addEventListener('click', () => showAuthForm('login'));

  if (useSavedSessionBtn) {
    useSavedSessionBtn.addEventListener('click', () => {
      if (!getToken().trim()) {
        writeOutput('Saved session', 'No saved token found. Please login.');
        updateSavedSessionPrompt();
        return;
      }

      tokenConfirmed = false;
      setAuthState(true);
      writeOutput('Saved session', 'Login successful. Open Connection and click Save Token to continue.');
    });
  }

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(signupForm);

    try {
      const result = await request('/users/signup', 'POST', body);

      if (result.ok) {
        showAuthForm('login');
        loginForm.elements.login_with.value = 'email';
        applyLoginMode();
        if (body.email) {
          loginForm.elements.email.value = body.email;
        }
        if (body.phone) {
          loginForm.elements.phone.value = body.phone;
        }
        if (body.role) {
          loginForm.elements.role.value = body.role;
        }
        loginForm.elements.plain_password.value = '';
        writeOutput('Signup successful', {
          ...result,
          next_step: 'Account created. Please login now.',
        });
        return;
      }

      writeOutput('Signup response', result);
    } catch (err) {
      writeOutput('Signup error', err.message);
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(loginForm);

    const loginWith = body.login_with;
    delete body.login_with;

    if (loginWith === 'email') {
      delete body.phone;
      if (!body.email) {
        writeOutput('Login error', 'Please enter your email.');
        return;
      }
    } else {
      delete body.email;
      if (!body.phone) {
        writeOutput('Login error', 'Please enter your phone number.');
        return;
      }
    }

    try {
      const result = await request('/users/login', 'POST', body);
      const token = result.response?.data?.token;

      if (result.ok && token) {
        saveToken(token);
        tokenConfirmed = false;
        updateSavedSessionPrompt();
        setAuthState(true);
        showWorkspace('connection');
      }

      if (!result.ok && loginWith === 'phone' && result.status === 404) {
        writeOutput('Login response', {
          ...result,
          response: {
            ...result.response,
            error: {
              ...(result.response?.error || {}),
              message: 'This phone number is not registered. Please sign up first or use email login.',
            },
          },
        });
        return;
      }

      writeOutput('Login response', result);
    } catch (err) {
      writeOutput('Login error', err.message);
    }
  });
}

function initWorkspaceTabs() {
  workspaceButtons.forEach((button) => {
    button.addEventListener('click', () => showWorkspace(button.dataset.workspace));
  });
}

function initPatientWorkspace() {
  const createForm = document.getElementById('create-patient-form');
  const updateForm = document.getElementById('update-patient-form');
  const showUpdateBtn = document.getElementById('show-update-patient-btn');
  const generateHealthIdBtn = document.getElementById('generate-health-id-btn');
  
  const generateHealthId = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 90000) + 10000;
    const healthId = `CL-PT-${year}-${randomNum}`;
    return healthId;
  };
  const profileDetails = document.getElementById('patient-profile-details');
  const patientDetailFields = {
    full_name: document.getElementById('patient-detail-full_name'),
    health_id: document.getElementById('patient-detail-health_id'),
    date_of_birth: document.getElementById('patient-detail-date_of_birth'),
    gender: document.getElementById('patient-detail-gender'),
    blood_group: document.getElementById('patient-detail-blood_group'),
    email: document.getElementById('patient-detail-email'),
    phone: document.getElementById('patient-detail-phone'),
  };

  const formatDateValue = (value) => {
    if (!value) {
      return '-';
    }

    // Prefer direct YYYY-MM-DD parsing to avoid timezone and locale issues.
    const isoMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(value));
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const renderPatientDetails = (patient) => {
    if (!patient) {
      profileDetails.classList.add('hidden');
      Object.values(patientDetailFields).forEach((field) => {
        field.textContent = '-';
      });
      return;
    }

    profileDetails.classList.remove('hidden');
    patientDetailFields.full_name.textContent = patient.full_name || '-';
    patientDetailFields.health_id.textContent = patient.health_id || '-';
    patientDetailFields.date_of_birth.textContent = formatDateValue(patient.date_of_birth);
    patientDetailFields.gender.textContent = patient.gender || '-';
    patientDetailFields.blood_group.textContent = patient.blood_group || '-';
    patientDetailFields.email.textContent = patient.email || '-';
    patientDetailFields.phone.textContent = patient.phone || '-';
  };

  const setPatientProfileMode = (hasProfile) => {
    createForm.classList.toggle('hidden', hasProfile);
    showUpdateBtn.classList.toggle('hidden', !hasProfile);
    profileDetails.classList.toggle('hidden', !hasProfile);

    if (!hasProfile) {
      updateForm.classList.add('hidden');
      showUpdateBtn.textContent = 'Update Patient Profile';
      renderPatientDetails(null);
    }
  };

  syncPatientProfileState = async () => {
    try {
      const result = await request('/patients', 'GET');

      if (result.ok) {
        setPatientProfileMode(true);
        renderPatientDetails(result.response?.data || null);
        return;
      }

      if (result.status === 404) {
        setPatientProfileMode(false);
      }
    } catch {
      // Keep current UI state if profile check fails.
    }
  };

  generateHealthIdBtn.addEventListener('click', () => {
    const healthIdInput = createForm.querySelector('input[name="health_id"]');
    healthIdInput.value = generateHealthId();
  });

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(createForm);

    try {
      const result = await request('/patients', 'POST', body);
      writeOutput('Create patient profile response', result);

      if (result.ok) {
        await syncPatientProfileState();
      }
    } catch (err) {
      writeOutput('Create patient profile error', err.message);
    }
  });

  showUpdateBtn.addEventListener('click', () => {
    const makeVisible = updateForm.classList.contains('hidden');
    updateForm.classList.toggle('hidden', !makeVisible);
    showUpdateBtn.textContent = makeVisible ? 'Hide Update Patient Profile' : 'Update Patient Profile';

    if (makeVisible) {
      updateForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(updateForm);

    try {
      const result = await request('/patients', 'PUT', body);
      writeOutput('Update patient profile response', result);

      if (result.ok) {
        await syncPatientProfileState();
      }
    } catch (err) {
      writeOutput('Update patient profile error', err.message);
    }
  });

  bindClick('menu-get-patient-profile-btn', async () => {
    try {
      const result = await request('/patients', 'GET');
      writeOutput('Get own profile response', result);
    } catch (err) {
      writeOutput('Get own profile error', err.message);
    }
  });

  bindClick('menu-get-patient-consultations-btn', async () => {
    try {
      const result = await request('/patients/consultations', 'GET');
      writeOutput('Get consultations response', result);
    } catch (err) {
      writeOutput('Get consultations error', err.message);
    }
  });

  bindClick('menu-get-patient-access-list-btn', async () => {
    try {
      const result = await request('/patients/access-list', 'GET');
      writeOutput('Get access list response', result);
    } catch (err) {
      writeOutput('Get access list error', err.message);
    }
  });
}

function initDoctorWorkspace() {
  const createForm = document.getElementById('create-doctor-form');
  const updateForm = document.getElementById('update-doctor-form');
  const showUpdateBtn = document.getElementById('show-update-doctor-btn');
  const doctorLookupShortcutBtn = document.getElementById('doctor-lookup-shortcut-btn');
  const doctorEmergencyShortcutBtn = document.getElementById('doctor-emergency-shortcut-btn');
  const doctorLookupSection = document.getElementById('doctor-lookup-section');
  const doctorEmergencySection = document.getElementById('doctor-emergency-form');
  const profileDetails = document.getElementById('doctor-profile-details');
  const doctorDetailFields = {
    full_name: document.getElementById('doctor-detail-full_name'),
    license_number: document.getElementById('doctor-detail-license_number'),
    specialization: document.getElementById('doctor-detail-specialization'),
  };

  const renderDoctorDetails = (doctor) => {
    if (!doctor) {
      profileDetails.classList.add('hidden');
      Object.values(doctorDetailFields).forEach((field) => {
        field.textContent = '-';
      });
      return;
    }

    profileDetails.classList.remove('hidden');
    doctorDetailFields.full_name.textContent = doctor.full_name || '-';
    doctorDetailFields.license_number.textContent = doctor.license_number || '-';
    doctorDetailFields.specialization.textContent = doctor.specialization || '-';
  };

  const showDoctorSection = (section) => {
    doctorLookupSection.classList.toggle('hidden', section !== 'lookup');
    doctorEmergencySection.classList.toggle('hidden', section !== 'emergency');
  };

  const setDoctorProfileMode = (hasProfile) => {
    createForm.classList.toggle('hidden', hasProfile);
    showUpdateBtn.classList.toggle('hidden', !hasProfile);
    doctorLookupShortcutBtn.classList.toggle('hidden', !hasProfile);
    doctorEmergencyShortcutBtn.classList.toggle('hidden', !hasProfile);
    profileDetails.classList.toggle('hidden', !hasProfile);

    if (!hasProfile) {
      updateForm.classList.add('hidden');
      showUpdateBtn.textContent = 'Update Doctor Profile';
      showDoctorSection('none');
      renderDoctorDetails(null);
    }
  };

  syncDoctorProfileState = async () => {
    try {
      const result = await request('/doctors', 'GET');

      if (result.ok) {
        setDoctorProfileMode(true);
        renderDoctorDetails(result.response?.data || null);
        return;
      }

      if (result.status === 404) {
        setDoctorProfileMode(false);
      }
    } catch {
      // Keep current UI state if profile check fails.
    }
  };

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(createForm);

    try {
      const result = await request('/doctors', 'POST', body);
      writeOutput('Create doctor profile response', result);

      if (result.ok) {
        await syncDoctorProfileState();
      }
    } catch (err) {
      writeOutput('Create doctor profile error', err.message);
    }
  });

  showUpdateBtn.addEventListener('click', () => {
    const makeVisible = updateForm.classList.contains('hidden');
    updateForm.classList.toggle('hidden', !makeVisible);
    showUpdateBtn.textContent = makeVisible ? 'Hide Update Doctor Profile' : 'Update Doctor Profile';

    if (makeVisible) {
      updateForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  doctorLookupShortcutBtn.addEventListener('click', () => {
    showDoctorSection('lookup');
    doctorLookupSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  doctorEmergencyShortcutBtn.addEventListener('click', () => {
    showDoctorSection('emergency');
    doctorEmergencySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formToObject(updateForm);

    try {
      const result = await request('/doctors', 'PUT', body);
      writeOutput('Update doctor profile response', result);

      if (result.ok) {
        await syncDoctorProfileState();
      }
    } catch (err) {
      writeOutput('Update doctor profile error', err.message);
    }
  });

  bindClick('get-doctor-by-id-btn', async () => {
    const doctorId = document.getElementById('doctor-id-input').value.trim();

    if (!doctorId) {
      writeOutput('Get doctor by id error', 'Please enter a doctor id.');
      return;
    }

    try {
      const result = await request(`/doctors/${doctorId}`, 'GET');
      writeOutput('Get doctor by id response', result);
    } catch (err) {
      writeOutput('Get doctor by id error', err.message);
    }
  });

  bindForm('doctor-emergency-form', 'Emergency patient snapshot response', '/doctors/emergency', 'GET', (_body, form) => {
    const patientId = form.elements.patientId.value.trim();
    const clinicId = form.elements.clinicId.value.trim();

    if (!patientId || !clinicId) {
      throw new Error('patientId and clinicId are required');
    }

    return {
      path: `/doctors/emergency/${patientId}/${clinicId}`,
      body: null,
    };
  });
}

function initConsultationWorkspace() {
  const updateStatusForm = document.getElementById('update-consultation-status-form');
  const prescriptionForm = document.getElementById('prescription-form');
  const getPrescriptionForm = document.getElementById('get-prescription-form');
  const consultationStatusShortcutBtn = document.getElementById('consultation-status-shortcut-btn');
  const consultationPrescriptionShortcutBtn = document.getElementById('consultation-prescription-shortcut-btn');
  const consultationGetPrescriptionShortcutBtn = document.getElementById('consultation-get-prescription-shortcut-btn');

  const showConsultationSection = (section) => {
    updateStatusForm.classList.toggle('hidden', section !== 'status');
    prescriptionForm.classList.toggle('hidden', section !== 'prescription');
    getPrescriptionForm.classList.toggle('hidden', section !== 'getPrescription');
  };

  showConsultationSection('none');

  consultationStatusShortcutBtn.addEventListener('click', () => {
    showConsultationSection('status');
    updateStatusForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  consultationPrescriptionShortcutBtn.addEventListener('click', () => {
    showConsultationSection('prescription');
    prescriptionForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  consultationGetPrescriptionShortcutBtn.addEventListener('click', () => {
    showConsultationSection('getPrescription');
    getPrescriptionForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  bindForm('start-consultation-form', 'Start consultation response', '/consultations', 'POST', (body) => {
    const role = getCurrentRole();
    if (role !== 'doctor') {
      throw new Error('Start Consultation is only allowed for doctor accounts. Please login as doctor.');
    }

    const patientId = body.patient_id;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(String(patientId || '').trim())) {
      throw new Error('patient_id must be a UUID (not Health ID like CL-PT-2026-10293).');
    }

    return body;
  });
  bindForm('get-consultation-form', 'Get consultation response', '/consultations', 'GET', (_body, form) => {
    const consultationId = form.elements.consultationId.value.trim();
    if (!consultationId) {
      throw new Error('consultationId is required');
    }

    return {
      path: `/consultations/${consultationId}`,
      body: null,
    };
  });

  bindForm('update-consultation-status-form', 'Update consultation status response', '/consultations', 'PUT', (body, form) => {
    const consultationId = form.elements.consultationId.value.trim();
    const status = body.status;

    if (!consultationId || !status) {
      throw new Error('consultationId and status are required');
    }

    return {
      path: `/consultations/${consultationId}/status`,
      body: { status },
    };
  });

  bindForm('prescription-form', 'Save prescription response', '/consultations', 'POST', (body, form) => {
    const consultationId = form.elements.consultationId.value.trim();
    const items = JSON.parse(form.elements.items_json.value.trim());

    if (!consultationId) {
      throw new Error('consultationId is required');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Prescription items must be a non-empty JSON array');
    }

    return {
      path: `/consultations/${consultationId}/prescription`,
      body: { items },
    };
  });

  bindForm('get-prescription-form', 'Get prescription response', '/consultations', 'GET', (_body, form) => {
    const consultationId = form.elements.consultationId.value.trim();
    if (!consultationId) {
      throw new Error('consultationId is required');
    }

    return {
      path: `/consultations/${consultationId}/prescription`,
      body: null,
    };
  });
}

function initClinicsWorkspace() {
  const clinicLookupSection = document.getElementById('clinic-lookup-section');
  const updateClinicForm = document.getElementById('update-clinic-form');
  const clinicLookupShortcutBtn = document.getElementById('clinic-lookup-shortcut-btn');
  const clinicUpdateShortcutBtn = document.getElementById('clinic-update-shortcut-btn');

  const showClinicSection = (section) => {
    clinicLookupSection.classList.toggle('hidden', section !== 'lookup');
    updateClinicForm.classList.toggle('hidden', section !== 'update');
  };

  clinicLookupShortcutBtn.addEventListener('click', () => {
    showClinicSection('lookup');
    clinicLookupSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  clinicUpdateShortcutBtn.addEventListener('click', () => {
    showClinicSection('update');
    updateClinicForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  bindForm('create-clinic-form', 'Create clinic response', '/clinics', 'POST');
  bindForm('update-clinic-form', 'Update clinic response', '/clinics', 'PUT', (body, form) => {
    const clinicId = form.elements.clinicId.value.trim();
    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    return {
      path: `/clinics/${clinicId}`,
      body,
    };
  });

  bindClick('get-clinics-btn', async () => {
    try {
      const result = await request('/clinics', 'GET');
      writeOutput('Get clinics response', result);
    } catch (err) {
      writeOutput('Get clinics error', err.message);
    }
  });

  bindClick('get-clinic-by-id-btn', async () => {
    const clinicId = document.getElementById('clinic-id-input').value.trim();

    if (!clinicId) {
      writeOutput('Get clinic by id error', 'Please enter a clinic id.');
      return;
    }

    try {
      const result = await request(`/clinics/${clinicId}`, 'GET');
      writeOutput('Get clinic by id response', result);
    } catch (err) {
      writeOutput('Get clinic by id error', err.message);
    }
  });

  bindClick('delete-clinic-btn', async () => {
    const clinicId = document.getElementById('clinic-id-input').value.trim();

    if (!clinicId) {
      writeOutput('Delete clinic error', 'Please enter a clinic id.');
      return;
    }

    try {
      const result = await request(`/clinics/${clinicId}`, 'DELETE');
      writeOutput('Delete clinic response', result);
    } catch (err) {
      writeOutput('Delete clinic error', err.message);
    }
  });
}

function initMedicationWorkspace() {
  const addShortcutBtn = document.getElementById('medication-add-shortcut-btn');
  const lookupShortcutBtn = document.getElementById('medication-lookup-shortcut-btn');
  const updateShortcutBtn = document.getElementById('medication-update-shortcut-btn');
  const createMedicationUserIdInput = document.querySelector('#create-medication-form input[name="user_id"]');
  const lookupSection = document.getElementById('medication-lookup-section');
  const updateForm = document.getElementById('update-medication-form');

  if (addShortcutBtn && createMedicationUserIdInput) {
    addShortcutBtn.addEventListener('click', () => {
      createMedicationUserIdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      createMedicationUserIdInput.focus();
    });
  }

  if (lookupShortcutBtn && lookupSection) {
    lookupShortcutBtn.addEventListener('click', () => {
      lookupSection.classList.remove('hidden');
      lookupSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (updateShortcutBtn && updateForm) {
    updateShortcutBtn.addEventListener('click', () => {
      updateForm.classList.remove('hidden');
      updateForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  bindForm('create-medication-form', 'Create medication response', '/medications', 'POST');
  bindForm('update-medication-form', 'Update medication response', '/medications', 'PUT', (body, form) => {
    const medicationId = form.elements.medicationId.value.trim();
    if (!medicationId) {
      throw new Error('medicationId is required');
    }

    return {
      path: `/medications/${medicationId}`,
      body,
    };
  });

  bindClick('get-my-medications-btn', async () => {
    const userId = getCurrentUserId();

    if (!userId) {
      writeOutput('Get my medications error', 'Save a valid JWT token first.');
      return;
    }

    try {
      const result = await request(`/medications/${userId}`, 'GET');
      writeOutput('Get my medications response', result);
    } catch (err) {
      writeOutput('Get my medications error', err.message);
    }
  });

  bindClick('get-medications-by-user-btn', async () => {
    const userId = document.getElementById('medication-user-id-input').value.trim();

    if (!userId) {
      writeOutput('Get medications by user error', 'Please enter a user id.');
      return;
    }

    try {
      const result = await request(`/medications/${userId}`, 'GET');
      writeOutput('Get medications by user response', result);
    } catch (err) {
      writeOutput('Get medications by user error', err.message);
    }
  });

  bindClick('delete-medication-btn', async () => {
    const medicationId = document.getElementById('medication-id-input').value.trim();

    if (!medicationId) {
      writeOutput('Delete medication error', 'Please enter a medication id.');
      return;
    }

    try {
      const result = await request(`/medications/${medicationId}`, 'DELETE');
      writeOutput('Delete medication response', result);
    } catch (err) {
      writeOutput('Delete medication error', err.message);
    }
  });
}

function initAdminWorkspace() {
  bindForm('verify-doctor-form', 'Verify doctor response', '/admin/doctors/verify', 'PUT', (_body, form) => {
    const doctorId = form.elements.doctorId.value.trim();

    if (!doctorId) {
      throw new Error('doctorId is required');
    }

    return {
      path: `/admin/doctors/${doctorId}/verify`,
      body: null,
    };
  });
}

function initConnection() {
  const storedToken = getToken().trim();
  const tokenToUse = parseTokenPayload(storedToken) ? storedToken : createGuestToken(GUEST_ROLE);

  saveToken(tokenToUse);
  tokenConfirmed = true;
  tokenInput.value = tokenToUse;
  setAuthState(true);
  showWorkspace('connection');
  updateSavedSessionPrompt();

  bindClick('save-token-btn', () => {
    saveToken(tokenInput.value.trim());
    updateSavedSessionPrompt();

    const role = getCurrentRole();
    if (!role) {
      tokenConfirmed = false;
      setAuthState(false);
      showAuthForm('login');
      writeOutput('Token status', 'Token saved, but it is not a valid JWT for this app. Please login again.');
      return;
    }

    tokenConfirmed = true;
    setAuthState(true);
    showWorkspace(secondWorkspaceForRole(role));
    writeOutput('Token status', `Token saved. Opened ${secondWorkspaceForRole(role)} workspace.`);
  });

  bindClick('clear-token-btn', () => {
    removeToken();
    tokenConfirmed = false;
    setAuthState(false);
    showAuthForm('signup');
    updateSavedSessionPrompt();
    writeOutput('Token status', 'Token removed.');
  });

  bindClick('switch-account-btn', () => {
    removeToken();
    tokenConfirmed = false;
    setAuthState(false);
    showAuthForm('signup');
    updateSavedSessionPrompt();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    writeOutput('Account switch', 'Signed out locally. Use Sign Up or Login now.');
  });

  bindClick('check-health-btn', checkServerHealth);
}

function init() {
  initConnection();
  initAuth();
  initWorkspaceTabs();
  initPatientWorkspace();
  initDoctorWorkspace();
  initConsultationWorkspace();
  initClinicsWorkspace();
  initMedicationWorkspace();
  initAdminWorkspace();
}

init();
