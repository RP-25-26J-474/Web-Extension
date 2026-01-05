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
    
    // Check onboarding status
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
    
    if (!userData.user.consentGiven) {
      showConsentSection();
    } else {
      showMainContent();
      displayUserInfo(userData.user);
      await loadData();
    }
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
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
}

// Show onboarding prompt
function showOnboardingPrompt(user) {
  console.log('🎮 Showing onboarding prompt for user:', user?.name);
  
  try {
    // Hide other sections
    const authSection = document.getElementById('authSection');
    const consentSection = document.getElementById('consentSection');
    const mainContent = document.getElementById('mainContent');
    
    if (authSection) authSection.style.display = 'none';
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
        <h2>Welcome ${userName}! 🎉</h2>
        <p class="onboarding-description">
          Before you start tracking, let's complete a quick onboarding assessment.
          This helps us understand your device capabilities and preferences.
        </p>
        
        <div class="onboarding-tests">
          <div class="test-card">
            <span class="test-icon">🎯</span>
            <h3>Motor Skills</h3>
            <p>Test reaction time and accuracy</p>
          </div>
          <div class="test-card">
            <span class="test-icon">📚</span>
            <h3>Computer Literacy</h3>
            <p>Quick quiz on UI concepts</p>
          </div>
          <div class="test-card">
            <span class="test-icon">👁️</span>
            <h3>Vision Tests</h3>
            <p>Color blindness & visual acuity</p>
          </div>
        </div>
        
        <p class="onboarding-note">
          ⏱️ Takes about 5-7 minutes • Your data is private and secure
        </p>
        
        <div class="onboarding-actions">
          <button id="startOnboardingBtn" class="btn btn-primary full-width">
            Start Onboarding Game
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
  document.getElementById('consentSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

// Show main content
function showMainContent() {
  document.getElementById('authSection').style.display = 'none';
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
    
    if (data.user.consentGiven) {
      showMainContent();
      displayUserInfo(data.user);
      await loadData();
    } else {
      showConsentSection();
    }
    
    showNotification('Login successful!', 'success');
    
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = error.message || 'Login failed. Please check your credentials.';
    errorDiv.style.display = 'block';
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
  
  if (age < 1 || age > 120) {
    errorDiv.textContent = 'Please enter a valid age (1-120)';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    document.getElementById('registerBtn').disabled = true;
    document.getElementById('registerBtn').textContent = 'Creating account...';
    errorDiv.style.display = 'none';
    
    await apiClient.register(email, password, name, age, gender);
    
    showConsentSection();
    showNotification('Account created successfully!', 'success');
    
  } catch (error) {
    console.error('Registration error:', error);
    errorDiv.textContent = error.message || 'Registration failed. Please try again.';
    errorDiv.style.display = 'block';
  } finally {
    document.getElementById('registerBtn').disabled = false;
    document.getElementById('registerBtn').textContent = 'Create Account';
  }
}

// Handle logout
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    await apiClient.logout();
    
    // Clear local storage
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
    // Enable tracking in background (fire and forget - don't await)
    console.log('📤 Enabling tracking...');
    chrome.runtime.sendMessage({ 
      type: 'SET_CONSENT', 
      consent: true 
    }).catch(() => {}); // Ignore errors
    
    // Also set in storage directly as backup
    chrome.storage.local.set({ 
      trackingEnabled: true, 
      consentGiven: true 
    });
    
    console.log('✅ Tracking enabled locally');
    
    // Try to update server settings (non-blocking)
    apiClient.updateSettings(true, true).catch(err => {
      console.warn('⚠️ Could not update server settings:', err.message);
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

