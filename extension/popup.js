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
        <button id="skipOnboardingBtn" class="btn btn-secondary full-width" style="margin-top: 10px;">
          Skip for Now
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById('startOnboardingBtn').addEventListener('click', startOnboardingGame);
  document.getElementById('skipOnboardingBtn').addEventListener('click', skipOnboarding);
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

// Skip onboarding (proceed to consent)
async function skipOnboarding() {
  if (!confirm('Are you sure you want to skip the onboarding assessment? You can always complete it later from settings.')) {
    return;
  }
  
  showConsentSection();
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
  
  // Consent buttons
  document.getElementById('acceptConsent')?.addEventListener('click', handleAcceptConsent);
  document.getElementById('declineConsent')?.addEventListener('click', handleDeclineConsent);
  
  // Tracking toggle
  document.getElementById('trackingToggle')?.addEventListener('change', handleTrackingToggle);
  
  // Configuration checkboxes
  document.getElementById('trackClicks')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackKeystrokes')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackMovements')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackPageViews')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackDoubleClicks')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackRightClicks')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackMouseHovers')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackDragAndDrop')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackTouchEvents')?.addEventListener('change', handleConfigChange);
  document.getElementById('trackZoomEvents')?.addEventListener('change', handleConfigChange);
  
  // Action buttons
  document.getElementById('refreshBtn')?.addEventListener('click', loadRecentInteractions);
  document.getElementById('exportBtn')?.addEventListener('click', handleExportData);
  document.getElementById('clearBtn')?.addEventListener('click', handleClearData);
  document.getElementById('revokeConsent')?.addEventListener('click', handleRevokeConsent);
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
  try {
    await apiClient.updateSettings(true, true);
    
    await chrome.runtime.sendMessage({ 
      type: 'SET_CONSENT', 
      consent: true 
    });
    
    // Check onboarding status
    console.log('🔍 Checking onboarding status after consent...');
    const onboardingStatus = await apiClient.getOnboardingStatus();
    console.log('📋 Onboarding status:', onboardingStatus);
    
    if (!onboardingStatus.completed) {
      // User needs to complete onboarding game - START IMMEDIATELY
      console.log('🎮 Starting onboarding game immediately...');
      showNotification('Starting onboarding game...', 'info');
      
      // Start the game right away (no prompt)
      await startOnboardingGame();
      
    } else {
      // User has completed onboarding, show main content
      console.log('✅ Onboarding already complete, showing main content...');
      const userData = await apiClient.getCurrentUser();
      showMainContent();
      displayUserInfo(userData.user);
      await loadData();
      showNotification('Tracking enabled! Your privacy is protected.', 'success');
    }
  } catch (error) {
    console.error('❌ Failed to accept consent:', error);
    showNotification('Failed to enable tracking', 'error');
  }
}

// Handle consent decline
function handleDeclineConsent() {
  showNotification('Tracking disabled. You can enable it anytime.', 'info');
  window.close();
}

// Handle tracking toggle
async function handleTrackingToggle(event) {
  const enabled = event.target.checked;
  
  try {
    await chrome.runtime.sendMessage({ 
      type: 'TOGGLE_TRACKING', 
      enabled 
    });
    
    updateStatusIndicator(enabled);
    showNotification(
      enabled ? 'Tracking enabled' : 'Tracking paused', 
      enabled ? 'success' : 'info'
    );
  } catch (error) {
    console.error('Failed to toggle tracking:', error);
    showNotification('Failed to toggle tracking', 'error');
    event.target.checked = !enabled; // Revert
  }
}

// Handle configuration changes
async function handleConfigChange() {
  const config = {
    clicks: document.getElementById('trackClicks').checked,
    keystrokes: document.getElementById('trackKeystrokes').checked,
    mouseMovements: document.getElementById('trackMovements').checked,
    pageViews: document.getElementById('trackPageViews').checked,
    doubleClicks: document.getElementById('trackDoubleClicks').checked,
    rightClicks: document.getElementById('trackRightClicks').checked,
    mouseHovers: document.getElementById('trackMouseHovers').checked,
    dragAndDrop: document.getElementById('trackDragAndDrop').checked,
    touchEvents: document.getElementById('trackTouchEvents').checked,
    zoomEvents: document.getElementById('trackZoomEvents').checked
  };
  
  try {
    // Update in storage
    await chrome.storage.local.set({ trackingConfig: config });
    
    // Notify all tabs
    await chrome.runtime.sendMessage({ 
      type: 'UPDATE_CONFIG', 
      config 
    });
    
    // Notify content scripts in all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_CONFIG',
        config
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
    
    showNotification('Tracking options updated', 'success');
  } catch (error) {
    console.error('Failed to update config:', error);
    showNotification('Failed to update options', 'error');
  }
}

// Load all data
async function loadData() {
  try {
    // Get tracking state from local storage
    const result = await chrome.storage.local.get(['trackingEnabled', 'trackingConfig']);
    
    // Update tracking toggle
    const trackingToggle = document.getElementById('trackingToggle');
    if (trackingToggle) {
      trackingToggle.checked = result.trackingEnabled || false;
      updateStatusIndicator(result.trackingEnabled);
    }
    
    // Update configuration checkboxes
    if (result.trackingConfig) {
      document.getElementById('trackClicks').checked = result.trackingConfig.clicks !== false;
      document.getElementById('trackKeystrokes').checked = result.trackingConfig.keystrokes !== false;
      document.getElementById('trackMovements').checked = result.trackingConfig.mouseMovements !== false;
      document.getElementById('trackPageViews').checked = result.trackingConfig.pageViews !== false;
      document.getElementById('trackDoubleClicks').checked = result.trackingConfig.doubleClicks !== false;
      document.getElementById('trackRightClicks').checked = result.trackingConfig.rightClicks !== false;
      document.getElementById('trackMouseHovers').checked = result.trackingConfig.mouseHovers !== false;
      document.getElementById('trackDragAndDrop').checked = result.trackingConfig.dragAndDrop !== false;
      document.getElementById('trackTouchEvents').checked = result.trackingConfig.touchEvents !== false;
      document.getElementById('trackZoomEvents').checked = result.trackingConfig.zoomEvents !== false;
    }
    
    // Load stats from API
    const statsData = await apiClient.getStats();
    updateStatistics(statsData.stats);
    
    // Load recent interactions from API
    await loadRecentInteractions();
    
  } catch (error) {
    console.error('Failed to load data:', error);
    showNotification('Failed to load data', 'error');
  }
}

// Update statistics display
function updateStatistics(stats) {
  if (!stats) {
    stats = {
      totalInteractions: 0,
      clicks: 0,
      keystrokes: 0,
      mouseMovements: 0,
      pageViews: 0,
      doubleClicks: 0,
      rightClicks: 0,
      mouseHovers: 0,
      dragAndDrop: 0,
      touchEvents: 0,
      zoomEvents: 0
    };
  }
  
  document.getElementById('totalInteractions').textContent = formatNumber(stats.totalInteractions);
  document.getElementById('clicksCount').textContent = formatNumber(stats.clicks);
  document.getElementById('keystrokesCount').textContent = formatNumber(stats.keystrokes);
  document.getElementById('movementsCount').textContent = formatNumber(stats.mouseMovements);
  document.getElementById('pageViewsCount').textContent = formatNumber(stats.pageViews);
  document.getElementById('doubleClicksCount').textContent = formatNumber(stats.doubleClicks);
  document.getElementById('rightClicksCount').textContent = formatNumber(stats.rightClicks);
  document.getElementById('mouseHoversCount').textContent = formatNumber(stats.mouseHovers);
  document.getElementById('dragAndDropCount').textContent = formatNumber(stats.dragAndDrop);
  document.getElementById('touchEventsCount').textContent = formatNumber(stats.touchEvents);
  document.getElementById('zoomEventsCount').textContent = formatNumber(stats.zoomEvents);
  
  // Update recent count
  document.getElementById('recentCount').textContent = formatNumber(stats.totalInteractions);
}

// Load recent interactions
async function loadRecentInteractions() {
  try {
    const data = await apiClient.getRecentInteractions(10);
    const interactions = data.interactions || [];
    
    const listContainer = document.getElementById('interactionsList');
    
    if (interactions.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No interactions tracked yet</div>';
      return;
    }
    
    listContainer.innerHTML = interactions.map(interaction => {
      const time = new Date(interaction.timestamp).toLocaleTimeString();
      const type = interaction.type.replace('_', ' ');
      
      let details = '';
      switch (interaction.type) {
        case 'click':
        case 'double_click':
        case 'right_click':
          details = `${interaction.elementTag} - ${interaction.elementText?.substring(0, 30) || 'N/A'}`;
          break;
        case 'keypress':
          details = `Key: ${interaction.key}`;
          break;
        case 'mouse_move':
        case 'mouse_down':
        case 'mouse_up':
          details = `Position: (${interaction.x}, ${interaction.y})`;
          break;
        case 'mouse_enter':
        case 'mouse_leave':
          details = `${interaction.elementTag}${interaction.elementId ? '#' + interaction.elementId : ''}`;
          break;
        case 'page_view':
          details = interaction.title?.substring(0, 40) || 'N/A';
          break;
        case 'drag_start':
        case 'drag_end':
        case 'drop':
          details = `${interaction.elementTag} at (${interaction.x}, ${interaction.y})`;
          break;
        case 'touch_start':
        case 'touch_end':
          details = `${interaction.elementTag} - ${interaction.touchCount} touch(es)`;
          break;
        case 'touch_move':
          details = `Position: (${interaction.x}, ${interaction.y}) - ${interaction.touchCount} touch(es)`;
          break;
        case 'swipe':
          details = `${interaction.direction} - ${interaction.distance}px`;
          break;
        case 'pinch':
          details = `${interaction.action} - scale: ${interaction.scale}${interaction.initialDistance ? ` (${interaction.initialDistance}px → ${interaction.currentDistance}px)` : ''}`;
          break;
        case 'scroll':
          details = `Y: ${interaction.scrollY}`;
          break;
        case 'browser_zoom':
          details = `${interaction.action} - ${interaction.zoomLevel} (was ${interaction.previousZoom})`;
          break;
        case 'wheel_zoom':
          details = `${interaction.action} via ${interaction.method}`;
          break;
        case 'keyboard_zoom':
          details = `${interaction.action} (${interaction.key})`;
          break;
        case 'visual_viewport_zoom':
          details = `${interaction.action} - scale: ${interaction.scale}`;
          break;
        default:
          details = 'N/A';
      }
      
      return `
        <div class="interaction-item">
          <div class="interaction-type">${type}</div>
          <div class="interaction-details">${details}</div>
          <div class="interaction-time">${time} - ${truncateUrl(interaction.url)}</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load recent interactions:', error);
  }
}

// Handle export data
async function handleExportData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
    const interactions = response.interactions || [];
    
    if (interactions.length === 0) {
      showNotification('No data to export', 'info');
      return;
    }
    
    // Create CSV content
    const csv = convertToCSV(interactions);
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interaction-data-${Date.now()}.csv`;
    a.click();
    
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('Failed to export data:', error);
    showNotification('Failed to export data', 'error');
  }
}

// Convert interactions to CSV
function convertToCSV(interactions) {
  const headers = ['Timestamp', 'Type', 'URL', 'Page Title', 'Details'];
  const rows = interactions.map(i => {
    const timestamp = new Date(i.timestamp).toISOString();
    const details = JSON.stringify(i).replace(/"/g, '""');
    return [timestamp, i.type, i.url, i.pageTitle || '', details];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// Handle clear data
async function handleClearData() {
  if (!confirm('Are you sure you want to delete all tracked data? This action cannot be undone.')) {
    return;
  }
  
  try {
    await apiClient.clearInteractions();
    await loadData();
    showNotification('All data cleared successfully', 'success');
  } catch (error) {
    console.error('Failed to clear data:', error);
    showNotification('Failed to clear data', 'error');
  }
}

// Handle revoke consent
async function handleRevokeConsent() {
  if (!confirm('This will disable tracking and clear all data. Are you sure?')) {
    return;
  }
  
  try {
    // Clear all data first
    await chrome.runtime.sendMessage({ type: 'CLEAR_DATA' });
    
    // Revoke consent
    await chrome.runtime.sendMessage({ 
      type: 'SET_CONSENT', 
      consent: false 
    });
    
    // Reset storage
    await chrome.storage.local.set({
      consentGiven: false,
      trackingEnabled: false
    });
    
    showNotification('Consent revoked and data cleared', 'success');
    
    // Show consent screen again
    setTimeout(() => {
      showConsentSection();
    }, 1000);
    
  } catch (error) {
    console.error('Failed to revoke consent:', error);
    showNotification('Failed to revoke consent', 'error');
  }
}

// Update status indicator
function updateStatusIndicator(enabled) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (enabled) {
    indicator.classList.add('active');
    indicator.classList.remove('inactive');
    statusText.textContent = 'Active';
    statusText.style.color = '#4CAF50';
  } else {
    indicator.classList.add('inactive');
    indicator.classList.remove('active');
    statusText.textContent = 'Paused';
    statusText.style.color = '#f44336';
  }
}

// Utility function to format numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Utility function to truncate URL
function truncateUrl(url) {
  if (!url) return 'N/A';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.substring(0, 30) + '...';
  }
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

