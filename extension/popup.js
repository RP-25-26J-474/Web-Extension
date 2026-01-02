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
    const onboardingStatus = await apiClient.getOnboardingStatus();
    console.log('📋 Onboarding status:', onboardingStatus);
    
    if (!onboardingStatus.completed) {
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
  
  // Initialize event listeners (moved to top, but keep here for safety)
  // initializeEventListeners(); // Already called at the top
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
  console.log('🎮 Showing onboarding prompt');
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('consentSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
  
  // Create onboarding prompt (we'll add HTML for this)
  const container = document.querySelector('.container');
  let onboardingPrompt = document.getElementById('onboardingPrompt');
  
  if (!onboardingPrompt) {
    onboardingPrompt = document.createElement('div');
    onboardingPrompt.id = 'onboardingPrompt';
    onboardingPrompt.className = 'section';
    container.insertBefore(onboardingPrompt, container.querySelector('footer'));
  }
  
  onboardingPrompt.style.display = 'block';
  onboardingPrompt.innerHTML = `
    <div class="onboarding-prompt">
      <h2>Welcome ${user.name}! 🎉</h2>
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
  document.getElementById('startOnboardingBtn').addEventListener('click', startOnboardingGame);
}

// Start onboarding game in new tab
async function startOnboardingGame() {
  try {
    const token = await apiClient.getToken();
    const userData = await apiClient.getCurrentUser();
    
    // Build game URL with parameters
    const gameUrl = `${API_CONFIG.ONBOARDING_GAME_URL}?userId=${userData.user._id}&token=${token}&mode=aura`;
    
    console.log('🎮 Opening onboarding game:', gameUrl);
    
    // Open in new tab
    chrome.tabs.create({ url: gameUrl }, (tab) => {
      console.log('✅ Onboarding game opened in tab:', tab.id);
      showNotification('Onboarding game opened in new tab!', 'success');
      
      // Store tab ID to listen for completion
      chrome.storage.local.set({ onboardingTabId: tab.id });
    });
    
    // Close popup
    window.close();
    
  } catch (error) {
    console.error('Failed to start onboarding:', error);
    showNotification('Failed to open onboarding game', 'error');
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

// Handle consent acceptance
async function handleAcceptConsent() {
  const acceptBtn = document.getElementById('acceptConsent');
  
  try {
    // Disable button to prevent double clicks
    if (acceptBtn) {
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Enabling...';
    }
    
    console.log('📝 Updating settings...');
    await apiClient.updateSettings(true, true);
    console.log('✅ Settings updated');
    
    console.log('📤 Sending consent to background...');
    await chrome.runtime.sendMessage({ 
      type: 'SET_CONSENT', 
      consent: true 
    });
    console.log('✅ Background notified');
    
    // Check onboarding status
    console.log('🔍 Checking onboarding status...');
    let onboardingStatus;
    try {
      onboardingStatus = await apiClient.getOnboardingStatus();
      console.log('📋 Onboarding status:', onboardingStatus);
    } catch (statusError) {
      console.warn('⚠️ Could not get onboarding status, assuming not completed:', statusError);
      onboardingStatus = { completed: false };
    }
    
    // Get user data
    console.log('👤 Getting user data...');
    const userData = await apiClient.getCurrentUser();
    console.log('✅ User data:', userData.user?.name);
    
    if (!onboardingStatus.completed) {
      // User needs to complete onboarding game - show prompt
      console.log('🎮 Showing onboarding prompt...');
      showOnboardingPrompt(userData.user);
    } else {
      // User has completed onboarding, show main content
      console.log('✅ Onboarding complete, showing main content...');
      showMainContent();
      displayUserInfo(userData.user);
      await loadData();
      showNotification('Tracking enabled! Your privacy is protected.', 'success');
    }
  } catch (error) {
    console.error('❌ Failed to accept consent:', error);
    showNotification('Failed to enable tracking: ' + error.message, 'error');
  } finally {
    // Re-enable button
    if (acceptBtn) {
      acceptBtn.disabled = false;
      acceptBtn.textContent = 'Accept & Enable Tracking';
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

