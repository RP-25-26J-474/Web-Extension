// Popup Script - Manages the extension UI and user interactions

console.log('🚀 popup.js loaded');

// Initialize API client
let apiClient;
try {
  apiClient = new APIClient();
  console.log('✓ APIClient initialized:', apiClient.baseURL);
} catch (error) {
  console.error('✗ Failed to initialize APIClient:', error);
}

const PENDING_VERIFICATION_KEY = 'pendingVerification';
const PENDING_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

async function savePendingVerification(email) {
  if (!email) return;
  await chrome.storage.local.set({
    [PENDING_VERIFICATION_KEY]: {
      email: String(email).trim(),
      savedAt: Date.now()
    }
  });
}

async function getPendingVerificationEmail() {
  const data = await chrome.storage.local.get(PENDING_VERIFICATION_KEY);
  const pending = data?.[PENDING_VERIFICATION_KEY];

  if (!pending || typeof pending.email !== 'string') {
    return '';
  }

  if (
    pending.savedAt &&
    Number.isFinite(pending.savedAt) &&
    Date.now() - pending.savedAt > PENDING_VERIFICATION_TTL_MS
  ) {
    await clearPendingVerification();
    return '';
  }

  return pending.email.trim();
}

async function clearPendingVerification() {
  await chrome.storage.local.remove(PENDING_VERIFICATION_KEY);
}

const REGISTRATION_FLOW_STATE_KEY = 'registrationFlowState';
const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
const REGISTRATION_FLOW_STAGES = {
  VERIFICATION_PENDING: 'verification_pending',
  CONSENT_PENDING: 'consent_pending',
  ONBOARDING_PENDING: 'onboarding_pending',
};

async function getRegistrationFlowState() {
  const result = await chrome.storage.local.get([REGISTRATION_FLOW_STATE_KEY]);
  return result?.[REGISTRATION_FLOW_STATE_KEY] || null;
}

async function setRegistrationFlowState(stage) {
  if (!stage) return;
  await chrome.storage.local.set({
    [REGISTRATION_FLOW_STATE_KEY]: {
      stage,
      updatedAt: Date.now(),
    },
  });
}

async function clearRegistrationFlowState() {
  await chrome.storage.local.remove([REGISTRATION_FLOW_STATE_KEY]);
}

async function isOnboardingCompletedLocally() {
  const result = await chrome.storage.local.get([ONBOARDING_COMPLETED_KEY]);
  return result?.[ONBOARDING_COMPLETED_KEY] === true;
}

async function finalizeOnboardingFlow(user) {
  await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
  await clearRegistrationFlowState();
  showMainContent();
  if (user) {
    displayUserInfo(user);
  }
  await loadData();
}

async function continueRegistrationFlowIfNeeded(user) {
  if (!user) return false;

  let registrationFlowState = await getRegistrationFlowState();

  if (registrationFlowState?.stage === REGISTRATION_FLOW_STAGES.VERIFICATION_PENDING) {
    await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.CONSENT_PENDING);
    registrationFlowState = { stage: REGISTRATION_FLOW_STAGES.CONSENT_PENDING };
  }

  if (registrationFlowState?.stage === REGISTRATION_FLOW_STAGES.CONSENT_PENDING) {
    if (!user.consentGiven) {
      showConsentSection();
      return true;
    }

    await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.ONBOARDING_PENDING);
    registrationFlowState = { stage: REGISTRATION_FLOW_STAGES.ONBOARDING_PENDING };
  }

  if (registrationFlowState?.stage === REGISTRATION_FLOW_STAGES.ONBOARDING_PENDING) {
    if (await isOnboardingCompletedLocally()) {
      await finalizeOnboardingFlow(user);
      return true;
    }

    let onboardingStatus = { completed: false };
    try {
      onboardingStatus = await apiClient.getOnboardingStatus() || { completed: false };
    } catch (err) {
      console.warn('Could not get onboarding status:', err.message);
    }

    if (!onboardingStatus.completed) {
      showOnboardingPrompt(user);
      return true;
    }

    await finalizeOnboardingFlow(user);
    return true;
  }

  return false;
}

document.addEventListener('DOMContentLoaded', async function() {
  console.log('📄 DOMContentLoaded event fired');
  
  // Initialize event listeners FIRST before any async operations
  initializeEventListeners();
  console.log('✅ Event listeners initialized early');
  
  // Check if user is logged in
  const token = await apiClient.getToken();
  console.log('🔑 Token status:', token ? 'Found' : 'Not found');
  
  if (!token) {
    const pendingVerificationEmail = await getPendingVerificationEmail();
    if (pendingVerificationEmail) {
      showVerifyPendingSection(pendingVerificationEmail);
    } else {
      await clearRegistrationFlowState();
      showAuthSection();
    }
    return;
  }
  
  // Verify token is valid
  try {
    const userData = await apiClient.getCurrentUser();
    await clearPendingVerification();
    
    // CRITICAL: Sync user profile and settings from server to local storage
    // This ensures settings and userId are always in sync, even after a browser restart
    console.log('📥 Syncing user profile and settings from server...');
    await chrome.storage.local.set({
      userId: userData.user._id,
      consentGiven: userData.user.consentGiven || false,
      trackingEnabled: userData.user.trackingEnabled || false,
      userProfile: {
        userId: userData.user._id,
        email: userData.user.email ?? null,
        name: userData.user.name ?? null,
      }
    });
    console.log('✅ Settings synced:', {
      userId: userData.user._id,
      consentGiven: userData.user.consentGiven,
      trackingEnabled: userData.user.trackingEnabled
    });
    
    // Initialize aggregator if tracking is enabled
    if (userData.user.trackingEnabled) {
      chrome.runtime.sendMessage({ type: 'INIT_TRACKING' }).catch(err => {
        console.warn('⚠️ Could not initialize tracking:', err.message);
      });
    }
    
    if (await continueRegistrationFlowIfNeeded(userData.user)) {
      return;
    }

    showMainContent();
    displayUserInfo(userData.user);
    await loadData();
  } catch (error) {
    console.error('Authentication error:', error);
    await apiClient.clearToken();
    const pendingVerificationEmail = await getPendingVerificationEmail();
    if (pendingVerificationEmail) {
      showVerifyPendingSection(pendingVerificationEmail);
    } else {
      await clearRegistrationFlowState();
    showAuthSection();
    }
  }
});

// Show auth section
function showAuthSection() {
  console.log('📝 Showing auth section');
  hideOnboardingPrompt();
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('verifySection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
}

// Show verify-email-pending section (after register or when login fails with EMAIL_NOT_VERIFIED)
function showVerifyPendingSection(email) {
  console.log('📧 Showing verify pending for:', email);
  hideOnboardingPrompt();
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('verifySection').style.display = 'block';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';

  const emailEl = document.getElementById('verifyEmailAddress');
  const messageEl = document.getElementById('verifyEmailMessage');
  const inputEl = document.getElementById('verifyCodeInput');
  const continueBtn = document.getElementById('continueVerifyBtn');
  const resendBtn = document.getElementById('resendVerifyBtn');

  if (emailEl) {
    emailEl.textContent = email;
  }
  if (messageEl) {
    messageEl.textContent = 'Open the link we sent, copy the 6-digit code from the success page, and continue setup here.';
  }
  if (inputEl) {
    inputEl.value = '';
  }
  if (continueBtn) {
    continueBtn.textContent = 'Continue Setup';
  }
  if (resendBtn) {
    resendBtn.textContent = 'Send New Link';
  }

  const errorEl = document.getElementById('verifyCodeError');
  if (errorEl) {
    errorEl.style.display = 'none';
  }
  window.setTimeout(() => inputEl?.focus(), 0);
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  if (changes[ONBOARDING_COMPLETED_KEY]?.newValue !== true) return;

  (async () => {
    try {
      const token = await apiClient?.getToken?.();
      if (!token) return;

      const userData = await apiClient.getCurrentUser().catch(() => null);
      await finalizeOnboardingFlow(userData?.user || null);
    } catch (error) {
      console.warn('Could not refresh popup after onboarding completion:', error?.message || error);
    }
  })();
});

function hideOnboardingPrompt() {
  const onboardingPrompt = document.getElementById('onboardingPrompt');
  if (onboardingPrompt) {
    onboardingPrompt.style.display = 'none';
  }
}

// Show onboarding prompt
function showOnboardingPrompt(user) {
  console.log('🎮 Showing onboarding prompt for user:', user?.name);
  
  try {
    // Hide other sections
    const authSection = document.getElementById('authSection');
    const consentSection = document.getElementById('consentSection');
    const mainContent = document.getElementById('mainContent');
    
    const verifySection = document.getElementById('verifySection');
    if (authSection) authSection.style.display = 'none';
    if (verifySection) verifySection.style.display = 'none';
    if (consentSection) consentSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    
    // Create or find onboarding prompt
    const container = document.querySelector('.container');
    if (!container) {
      console.error('❌ Container not found!');
      return;
    }
    
    let onboardingPrompt = document.getElementById('onboardingPrompt');
    
    if (!onboardingPrompt) {
      onboardingPrompt = document.createElement('div');
      onboardingPrompt.id = 'onboardingPrompt';
      onboardingPrompt.className = 'section';
      
      // Try to insert before footer, or just append
      const footer = container.querySelector('footer');
      if (footer) {
        container.insertBefore(onboardingPrompt, footer);
      } else {
        container.appendChild(onboardingPrompt);
      }
    }
    
    const userName = user?.name || 'User';
    
    onboardingPrompt.style.display = 'block';
    onboardingPrompt.innerHTML = `
      <div class="onboarding-prompt">
        <div class="onboarding-prompt-card">
          <div class="onboarding-hero">
            <div class="welcome-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 21h4"/>
                <path d="M12 17v4"/>
                <path d="M8 21h8"/>
                <path d="M9 17h6l-1-11h-4l-1 11z"/>
                <path d="M12 3a2 2 0 0 1 2 2v1h-4V5a2 2 0 0 1 2-2z"/>
                <path d="M4 13a8 8 0 0 1 3-6"/>
                <path d="M20 13a8 8 0 0 0-3-6"/>
              </svg>
            </div>
            <div class="onboarding-hero-copy">
              <span class="onboarding-kicker">Lighthouse mission</span>
              <h2>Finish setup, ${userName}</h2>
              <p class="onboarding-description">
                Four short signal checks tune AURA to your accessibility profile before the extension fully unlocks.
              </p>
            </div>
          </div>
          <div class="onboarding-meta">
            <span class="meta-chip"><strong>4</strong> signal checks</span>
            <span class="meta-chip"><strong>~5 min</strong> total</span>
            <span class="meta-chip"><strong>1</strong> secure tab</span>
          </div>
          <div class="challenge-list">
            <div class="challenge-item">
              <div class="challenge-index">01</div>
              <div class="challenge-body">
                <div class="challenge-title-row">
                  <h3>Calibrate color signals</h3>
                </div>
                <p>Tune how AURA reads light, contrast, and color response.</p>
              </div>
            </div>
            <div class="challenge-item">
              <div class="challenge-index">02</div>
              <div class="challenge-body">
                <div class="challenge-title-row">
                  <h3>Focus the beam</h3>
                </div>
                <p>Measure clarity and accuracy so the UI can stay readable.</p>
              </div>
            </div>
            <div class="challenge-item">
              <div class="challenge-index">03</div>
              <div class="challenge-body">
                <div class="challenge-title-row">
                  <h3>Clear the signal noise</h3>
                </div>
                <p>Capture motor patterns that affect pointing and control.</p>
              </div>
            </div>
            <div class="challenge-item">
              <div class="challenge-index">04</div>
              <div class="challenge-body">
                <div class="challenge-title-row">
                  <h3>Lock the control panel</h3>
                </div>
                <p>Finish the profile so the extension can adapt around you.</p>
              </div>
            </div>
          </div>
          <div class="onboarding-features">
            <div class="feature-item">Color response</div>
            <div class="feature-item">Reading clarity</div>
            <div class="feature-item">Motor comfort</div>
          </div>
          <div class="onboarding-note">
            Launch the mission in a new tab, finish the checkpoints, and come back here. The popup will move forward automatically when your profile is ready.
          </div>
          <div class="onboarding-actions">
            <button id="startOnboardingBtn" class="btn btn-primary full-width btn-glow" aria-label="Start onboarding game - opens in new tab">
              <span class="btn-label">Start Lighthouse Mission</span>
              <span class="btn-arrow" aria-hidden="true">&rarr;</span>
            </button>
          </div>
          <p class="onboarding-footnote">Opens in a new tab and keeps this popup ready for your return.</p>
        </div>
      </div>
    `;
    
    // Add event listener
    const startBtn = document.getElementById('startOnboardingBtn');
    if (startBtn) {
      startBtn.addEventListener('click', startOnboardingGame);
    }
    
    console.log('✅ Onboarding prompt displayed');
    
  } catch (error) {
    console.error('❌ Error showing onboarding prompt:', error);
  }
}

// Start onboarding game in new tab
async function startOnboardingGame() {
  const startBtn = document.getElementById('startOnboardingBtn');
  const startBtnLabel = startBtn?.querySelector('.btn-label');
  const startBtnArrow = startBtn?.querySelector('.btn-arrow');
  
  try {
    // Disable button during processing
    if (startBtn) {
      startBtn.disabled = true;
      if (startBtnLabel) {
        startBtnLabel.textContent = 'Opening mission...';
      }
      if (startBtnArrow) {
        startBtnArrow.style.opacity = '0.35';
      }
    }
    
    const token = await apiClient.getToken();
    
    if (!token) {
      throw new Error('No authentication token');
    }
    
    // Try to get user data, but proceed even if it fails
    let userId = null;
    try {
      const userData = await apiClient.getCurrentUser();
      userId = userData?.user?._id;
    } catch (err) {
      console.warn('Could not get user data:', err.message);
    }
    
    // Build game URL with parameters - go directly to /play route (skip module selection)
    let gameUrl = `${API_CONFIG.ONBOARDING_GAME_URL}/play?token=${token}&mode=aura`;
    if (userId) {
      gameUrl += `&userId=${userId}`;
    }
    
    console.log('🎮 Opening onboarding game:', gameUrl);
    
    // Open in new tab
    chrome.tabs.create({ url: gameUrl }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Tab creation error:', chrome.runtime.lastError);
        showNotification('Failed to open game tab', 'error');
        return;
      }
      
      console.log('✅ Onboarding game opened in tab:', tab?.id);
      showNotification('Onboarding game opened in new tab!', 'success');
      
      // Store tab ID to listen for completion
      if (tab?.id) {
        chrome.storage.local.set({ onboardingTabId: tab.id });
      }
    });
    
    // Close popup after a short delay
    setTimeout(() => window.close(), 500);
    
  } catch (error) {
    console.error('Failed to start onboarding:', error);
    showNotification('Failed to open onboarding game: ' + error.message, 'error');
    
    // Re-enable button
    if (startBtn) {
      startBtn.disabled = false;
      if (startBtnLabel) {
        startBtnLabel.textContent = 'Start Lighthouse Mission';
      }
      if (startBtnArrow) {
        startBtnArrow.style.opacity = '1';
      }
    }
  }
}

// Show consent section
function showConsentSection() {
  hideOnboardingPrompt();
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('verifySection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

// Show main content
function showMainContent() {
  hideOnboardingPrompt();
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('verifySection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

// Display user info
function displayUserInfo(user) {
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userEmail').textContent = user.email;
}

// Initialize all event listeners
function initializeEventListeners() {
  console.log('🎧 Initializing event listeners...');
  
  // Auth tabs
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  
  console.log('Login tab element:', loginTab);
  console.log('Register tab element:', registerTab);
  
  loginTab?.addEventListener('click', () => {
    console.log('🖱️ Login tab clicked');
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
  });
  
  registerTab?.addEventListener('click', () => {
    console.log('🖱️ Register tab clicked');
    document.getElementById('registerTab').classList.add('active');
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
  });
  
  console.log('✓ Auth tab listeners attached');
  
  // Debug: Test if elements are actually in DOM
  setTimeout(() => {
    const authSection = document.getElementById('authSection');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    
    console.log('🔍 DOM Check (after timeout):');
    console.log('  authSection display:', authSection?.style.display);
    console.log('  loginTab:', loginTab ? 'EXISTS' : 'NULL');
    console.log('  registerTab:', registerTab ? 'EXISTS' : 'NULL');
    
    if (registerTab) {
      console.log('  registerTab is clickable:', registerTab.disabled ? 'NO (disabled)' : 'YES');
      console.log('  registerTab parent visible:', registerTab.parentElement ? 'YES' : 'NO');
    }
  }, 100);
  
  // Auth buttons
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click', handleRegister);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  // Verify section buttons
  document.getElementById('continueVerifyBtn')?.addEventListener('click', handleCompleteVerification);
  document.getElementById('resendVerifyBtn')?.addEventListener('click', handleResendVerification);
  document.getElementById('verifyCodeInput')?.addEventListener('input', (event) => {
    const input = event.target;
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    const errorEl = document.getElementById('verifyCodeError');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  });
  document.getElementById('verifyCodeInput')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleCompleteVerification();
  });
  document.getElementById('backToLoginFromVerify')?.addEventListener('click', async () => {
    await clearPendingVerification();
    await clearRegistrationFlowState();
    showAuthSection();
    document.getElementById('loginTab').click();
    const email = document.getElementById('verifyEmailAddress')?.textContent;
    if (email) {
      document.getElementById('loginEmail').value = email;
    }
  });

  // Consent button
  document.getElementById('acceptConsent')?.addEventListener('click', handleAcceptConsent);
}

// Manual test function (accessible from console)
window.testRegisterTab = function() {
  console.log('🧪 Manual test: Clicking register tab...');
  const registerTab = document.getElementById('registerTab');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  
  console.log('registerTab:', registerTab);
  console.log('registerForm:', registerForm);
  console.log('loginForm:', loginForm);
  
  if (registerTab) {
    registerTab.click();
    console.log('✓ Click triggered');
  } else {
    console.log('✗ Register tab not found');
  }
};

console.log('💡 Tip: Run window.testRegisterTab() in console to manually test');

// Handle login
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  
  if (!email || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    document.getElementById('loginBtn').disabled = true;
    document.getElementById('loginBtn').textContent = 'Logging in...';
    errorDiv.style.display = 'none';
    
    const data = await apiClient.login(email, password);
    
    // CRITICAL: Sync consent and tracking settings from server to local storage
    // Include userId so aggregator and background have it immediately (avoids race with api-client setToken)
    console.log('📥 Syncing user settings from server...');
    const activeUserId = data.user._id || data.user.id;
    await chrome.storage.local.set({
      userId: activeUserId,
      consentGiven: data.user.consentGiven || false,
      trackingEnabled: data.user.trackingEnabled || false,
      userProfile: {
        userId: activeUserId,
        email: data.user.email ?? null,
        name: data.user.name ?? null,
      },
    });
    await clearPendingVerification();
    console.log('✅ Settings synced:', {
      consentGiven: data.user.consentGiven,
      trackingEnabled: data.user.trackingEnabled
    });
    
    // Initialize aggregator if tracking is enabled
    if (data.user.trackingEnabled) {
      chrome.runtime.sendMessage({ type: 'INIT_TRACKING' }).catch(err => {
        console.warn('⚠️ Could not initialize tracking:', err.message);
      });
    }

    if (await continueRegistrationFlowIfNeeded(data.user)) {
      showNotification('Login successful!', 'success');
      return;
    }

    await clearRegistrationFlowState();
    showMainContent();
    displayUserInfo(data.user);
    await loadData();
    
    // Notify other components (tabs with sensecheck, dashboard, etc.) - broadcast token and userId
    chrome.runtime.sendMessage({
      type: 'BROADCAST_USER_LOGIN',
      token: data.token,
      userId: activeUserId,
      user: {
        email: data.user.email ?? null,
        name: data.user.name ?? null,
      },
      source: 'login',
    }).catch(() => {});

    // Fetch ML personalized profile on login (and when logging in again after logout)
    chrome.runtime.sendMessage({ type: 'FETCH_ML_PERSONALIZED_PROFILE' }).catch(() => {});
    
    showNotification('Login successful!', 'success');
    
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.VERIFICATION_PENDING);
      await savePendingVerification(email);
      showVerifyPendingSection(email);
      errorDiv.style.display = 'none';
    } else {
      errorDiv.textContent = error.message || 'Login failed. Please check your credentials.';
      errorDiv.style.display = 'block';
    }
  } finally {
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').textContent = 'Login';
  }
}

// Handle register
async function handleRegister() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const age = parseInt(document.getElementById('registerAge').value);
  const gender = document.getElementById('registerGender').value;
  const errorDiv = document.getElementById('registerError');
  
  if (!name || !email || !password || !age || !gender) {
    errorDiv.textContent = 'Please fill in all required fields';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (age < 18 || age > 120) {
    errorDiv.textContent = 'Please enter a valid age (18-120)';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    document.getElementById('registerBtn').disabled = true;
    document.getElementById('registerBtn').textContent = 'Creating account...';
    errorDiv.style.display = 'none';
    
    const data = await apiClient.register(email, password, name, age, gender);
    
    if (data.requiresVerification) {
      // Email verification required – no token until user verifies and logs in
      const verifyEmail = data.email || email;
      await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.VERIFICATION_PENDING);
      await savePendingVerification(verifyEmail);
      showVerifyPendingSection(verifyEmail);
      showNotification('Check your email for the verification link and code.', 'success');
    } else if (data.user && data.token) {
      // Legacy path (e.g. OAuth) – sync and show consent
      await chrome.storage.local.set({
        userId: data.user._id,
        userProfile: {
          userId: data.user._id,
          email: data.user.email ?? null,
          name: data.user.name ?? null,
        },
      });
      await clearPendingVerification();
      await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.CONSENT_PENDING);
      showConsentSection();
      showNotification('Account created successfully!', 'success');
    } else {
      await clearPendingVerification();
      await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.CONSENT_PENDING);
      showConsentSection();
      showNotification('Account created successfully!', 'success');
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    errorDiv.textContent = error.message || 'Registration failed. Please try again.';
    errorDiv.style.display = 'block';
  } finally {
    document.getElementById('registerBtn').disabled = false;
    document.getElementById('registerBtn').textContent = 'Create Account';
  }
}

// Handle complete verification (code from email – continues registration, no login)
async function handleCompleteVerification() {
  const emailEl = document.getElementById('verifyEmailAddress');
  const email = emailEl ? emailEl.textContent.trim() : '';
  const codeInput = document.getElementById('verifyCodeInput');
  const code = codeInput ? codeInput.value.trim().replace(/\D/g, '').slice(0, 6) : '';
  const errorEl = document.getElementById('verifyCodeError');
  const btn = document.getElementById('continueVerifyBtn');

  if (!email) {
    showNotification('Email not found. Please register again.', 'error');
    return;
  }
  if (code.length !== 6) {
    if (errorEl) {
      errorEl.textContent = 'Enter the 6-digit code from the verification page';
      errorEl.style.display = 'block';
    }
    return;
  }

  try {
    if (errorEl) errorEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
    const data = await apiClient.completeVerification(email, code);

    await chrome.storage.local.set({
      userId: data.user._id,
      consentGiven: data.user.consentGiven || false,
      trackingEnabled: data.user.trackingEnabled || false,
      userProfile: {
        userId: data.user._id,
        email: data.user.email ?? null,
        name: data.user.name ?? null,
      },
    });
    await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.CONSENT_PENDING);
    await clearPendingVerification();

    if (data.user.trackingEnabled) {
      chrome.runtime.sendMessage({ type: 'INIT_TRACKING' }).catch(() => {});
    }

    // Do NOT broadcast here – broadcast happens only when onboarding game completes (ONBOARDING_COMPLETE)
    // Other components have no use for the user until the profile is built

    showNotification('Email verified. Continue setup.', 'success');
    if (await continueRegistrationFlowIfNeeded(data.user)) {
      return;
    }
    showConsentSection();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Invalid or expired code. Try resending the verification email.';
      errorEl.style.display = 'block';
    }
    showNotification(error.message || 'Verification failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continue Setup'; }
  }
}

// Handle resend verification email
async function handleResendVerification() {
  const emailEl = document.getElementById('verifyEmailAddress');
  const email = emailEl ? emailEl.textContent.trim() : '';
  if (!email) {
    showNotification('Email not found. Please register again.', 'error');
    return;
  }
  const btn = document.getElementById('resendVerifyBtn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    await apiClient.resendVerificationEmail(email);
    showNotification('Verification email sent. Check your inbox.', 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to resend', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send New Link'; }
  }
}

// Handle logout
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    const { userId } = await chrome.storage.local.get(['userId']);
    // 1. Clear token + userId (triggers storage.onChanged → background cleanup)
    await apiClient.logout();
    
    // 2. Explicitly broadcast logout so background clears auth + ML profiles (belt-and-suspenders)
    await chrome.runtime.sendMessage({ type: 'BROADCAST_USER_LOGOUT', userId: userId || null }).catch(() => {});
    
    // 3. Clear remaining local storage (consent, config, etc.)
    await clearRegistrationFlowState();
    await chrome.storage.local.clear();
    
    showAuthSection();
    showNotification('Logged out successfully', 'success');
    
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
  }
}

// Handle consent acceptance - shows onboarding prompt
async function handleAcceptConsent() {
  const acceptBtn = document.getElementById('acceptConsent');
  
  // Disable button to prevent double clicks
  if (acceptBtn) {
    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Please wait...';
  }
  
  try {
    // STEP 1: Update server first (BLOCKING - must succeed)
    console.log('📤 Updating server consent settings...');
    try {
      await apiClient.updateSettings(true, true);
      console.log('✅ Server settings updated successfully');
    } catch (err) {
      console.error('❌ Failed to update server settings:', err);
      showNotification('Failed to save consent. Please try again.', 'error');
      if (acceptBtn) {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'I Understand, Continue';
      }
      return; // Stop if server update fails
    }
    
    // STEP 2: Set in local storage
    await chrome.storage.local.set({
      trackingEnabled: true,
      consentGiven: true
    });
    await setRegistrationFlowState(REGISTRATION_FLOW_STAGES.ONBOARDING_PENDING);
    console.log('✅ Tracking enabled in local storage');
    
    // STEP 3: Notify background script to initialize aggregator
    chrome.runtime.sendMessage({ 
      type: 'INIT_TRACKING'
    }).catch(err => {
      console.warn('⚠️ Could not notify background script:', err.message);
    });
    
    // Check onboarding status
    console.log('🔍 Checking onboarding status...');
    let onboardingStatus = { completed: false };
    let userData = null;
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      const [status, user] = await Promise.race([
        Promise.all([
          apiClient.getOnboardingStatus(),
          apiClient.getCurrentUser()
        ]),
        timeoutPromise
      ]);
      onboardingStatus = status || { completed: false };
      userData = user;
      console.log('📋 Onboarding status:', onboardingStatus);
    } catch (err) {
      console.warn('⚠️ Could not get status:', err.message);
      try {
        userData = await apiClient.getCurrentUser();
      } catch (userErr) {}
    }
    
    // If onboarding complete, show main content
    if (onboardingStatus?.completed) {
      console.log('✅ Onboarding complete, showing main content...');
      await clearRegistrationFlowState();
      showMainContent();
      if (userData?.user) {
        displayUserInfo(userData.user);
      }
      showNotification('Tracking enabled!', 'success');
    } else {
      // Show onboarding prompt
      console.log('🎮 Showing onboarding prompt...');
      const userName = userData?.user?.name || 'User';
      showOnboardingPrompt({ name: userName, _id: userData?.user?._id });
    }
    
  } catch (error) {
    console.error('❌ Consent handling failed:', error);
    
    // Even on error, show onboarding prompt
    try {
      showOnboardingPrompt({ name: 'User' });
    } catch (fallbackErr) {
      // Last resort: re-enable button
      if (acceptBtn) {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'I Understand, Continue';
      }
      showNotification('Error: ' + error.message, 'error');
    }
  }
}




// Impairment profile / ML motor-score: created only when motor game completes during onboarding.
// Do NOT call feature-vector or motor-score from popup on login – that triggers unnecessary API calls.

// Load all data
async function loadData() {
  // Nothing to load - tracking is always active
  console.log('✅ Tracking active');
}






// Show notification (simple visual feedback)
function showNotification(message, type = 'info') {
  // Create a simple notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 6px;
    font-size: 13px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);


