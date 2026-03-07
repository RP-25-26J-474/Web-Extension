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

document.addEventListener('DOMContentLoaded', async function() {
  console.log('📄 DOMContentLoaded event fired');
  
  // Initialize event listeners FIRST before any async operations
  initializeEventListeners();
  console.log('✅ Event listeners initialized early');
  
  // Check if user is logged in
  const token = await apiClient.getToken();
  console.log('🔑 Token status:', token ? 'Found' : 'Not found');
  
  if (!token) {
    showAuthSection();
    return;
  }
  
  // Verify token is valid
  try {
    const userData = await apiClient.getCurrentUser();
    
    // CRITICAL: Sync consent and tracking settings from server to local storage
    // This ensures settings are always in sync, even after logout/login
    console.log('📥 Syncing user settings from server...');
    await chrome.storage.local.set({
      consentGiven: userData.user.consentGiven || false,
      trackingEnabled: userData.user.trackingEnabled || false
    });
    console.log('✅ Settings synced:', {
      consentGiven: userData.user.consentGiven,
      trackingEnabled: userData.user.trackingEnabled
    });
    
    // Initialize aggregator if tracking is enabled
    if (userData.user.trackingEnabled) {
      chrome.runtime.sendMessage({ type: 'INIT_TRACKING' }).catch(err => {
        console.warn('⚠️ Could not initialize tracking:', err.message);
      });
    }
    
    // FIXED: Check consent BEFORE onboarding to prevent stuck users
    // If no consent given yet, show consent section first
    if (!userData.user.consentGiven) {
      console.log('⚠️ Consent not given, showing consent section');
      showConsentSection();
      return;
    }
    
    // Check onboarding status (only after consent is given)
    let onboardingStatus = { completed: false };
    try {
      onboardingStatus = await apiClient.getOnboardingStatus() || { completed: false };
    } catch (err) {
      console.warn('Could not get onboarding status:', err.message);
    }
    console.log('📋 Onboarding status:', onboardingStatus);
    
    if (!onboardingStatus.completed) {
      // Show onboarding prompt
      showOnboardingPrompt(userData.user);
      return;
    }

    // Onboarding complete – enable aggregated/global tracking
    await chrome.storage.local.set({ onboardingCompleted: true });
    
    // Both consent and onboarding complete - show main content
    showMainContent();
    displayUserInfo(userData.user);
    await loadData();
  } catch (error) {
    console.error('Authentication error:', error);
    await apiClient.clearToken();
    showAuthSection();
  }
});

// Show auth section
function showAuthSection() {
  console.log('📝 Showing auth section');
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('verifySection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
}

// Show verify-email-pending section (after register or when login fails with EMAIL_NOT_VERIFIED)
function showVerifyPendingSection(email) {
  console.log('📧 Showing verify pending for:', email);
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('verifySection').style.display = 'block';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('verifyEmailAddress').textContent = email;
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
        <div class="welcome-badge">
          <span class="welcome-emoji">🔦</span>
        </div>
        <h2>Welcome ${userName}!</h2>
        <p class="onboarding-description">
          Ready to restore the lighthouse? Four assessment tasks await to help us 
          personalize your experience and build your AURA profile.
        </p>
        
        <div class="game-cards-grid">
          <div class="game-card">
            <div class="game-card-icon">🎨</div>
            <div class="game-card-content">
              <h3>Calibrate the Light Colors</h3>
              <p>Align the prism so signals are not lost</p>
            </div>
          </div>
          <div class="game-card">
            <div class="game-card-icon">🔍</div>
            <div class="game-card-content">
              <h3>Focus the Beam</h3>
              <p>Sharpen the light to reach distant signals</p>
            </div>
          </div>
          <div class="game-card">
            <div class="game-card-icon">💨</div>
            <div class="game-card-content">
              <h3>Clear the Rising Fog</h3>
              <p>Remove corrupted data blocking the path</p>
            </div>
          </div>
          <div class="game-card">
            <div class="game-card-icon">⚙️</div>
            <div class="game-card-content">
              <h3>Restore the Control Panel</h3>
              <p>Make correct operational decisions</p>
            </div>
          </div>
        </div>
        
        <div class="onboarding-features">
          <div class="feature-item">
            <span class="feature-icon">⏱️</span>
            <span>About 5 minutes</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🔒</span>
            <span>100% Private</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✨</span>
            <span>Personalized profile</span>
          </div>
        </div>
        
        <div class="onboarding-actions">
          <button id="startOnboardingBtn" class="btn btn-primary full-width btn-glow" aria-label="Start onboarding game - opens in new tab">
            <span class="btn-text">Let's Play!</span>
            <span class="btn-arrow" aria-hidden="true">→</span>
          </button>
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
  
  try {
    // Disable button during processing
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = 'Opening...';
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
      startBtn.textContent = 'Start Onboarding Game';
    }
  }
}

// Show consent section
function showConsentSection() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('verifySection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

// Show main content
function showMainContent() {
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
  document.getElementById('backToLoginFromVerify')?.addEventListener('click', () => {
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
    
    if (data.user.consentGiven) {
      showMainContent();
      displayUserInfo(data.user);
      await loadData();
    } else {
      showConsentSection();
    }
    
    // Notify other components (tabs with sensecheck, dashboard, etc.) - broadcast token, not userId
    chrome.runtime.sendMessage({
      type: 'BROADCAST_USER_LOGIN',
      token: data.token,
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
      showVerifyPendingSection(data.email || email);
      showNotification('Check your email for the verification link.', 'success');
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
      showConsentSection();
      showNotification('Account created successfully!', 'success');
    } else {
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

    if (data.user.trackingEnabled) {
      chrome.runtime.sendMessage({ type: 'INIT_TRACKING' }).catch(() => {});
    }

    chrome.runtime.sendMessage({
      type: 'BROADCAST_USER_LOGIN',
      token: data.token,
      user: { email: data.user.email ?? null, name: data.user.name ?? null },
      source: 'registration',
      isRegistration: true,
    }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'FETCH_ML_PERSONALIZED_PROFILE' }).catch(() => {});

    showNotification('Email verified! Welcome.', 'success');
    showConsentSection();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Invalid or expired code. Try resending the verification email.';
      errorEl.style.display = 'block';
    }
    showNotification(error.message || 'Verification failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
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
    if (btn) { btn.disabled = false; btn.textContent = 'Resend Verification Email'; }
  }
}

// Handle logout
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    // 1. Clear token + userId (triggers storage.onChanged → background cleanup)
    await apiClient.logout();
    
    // 2. Explicitly broadcast logout so background clears auth + ML profiles (belt-and-suspenders)
    await chrome.runtime.sendMessage({ type: 'BROADCAST_USER_LOGOUT' }).catch(() => {});
    
    // 3. Clear remaining local storage (consent, config, etc.)
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

