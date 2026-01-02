# 🌟 AURA Interaction Tracker Extension

**Unleash the Future of UI**

A comprehensive, privacy-focused browser extension with MongoDB integration that tracks user interactions across all major browsers. Built with Manifest V3 and includes secure user authentication, cloud data storage, and real-time analytics.

## 🆕 New Features

### 🔐 User Authentication & Cloud Storage
- **User Accounts** - Register and login to sync your data
- **MongoDB Integration** - Secure cloud storage for your interaction data
- **Cross-Device Sync** - Access your data from any device
- **Team Analytics** - Share insights across your organization
- **API Access** - RESTful API for advanced integration

### 📊 Real-Time Analytics
- Data synced to MongoDB every 30 seconds
- Historical data retention (30 days)
- Advanced filtering and search capabilities
- Export data to CSV for analysis

## ✨ Features

### 📊 Comprehensive Interaction Tracking
- **Mouse Clicks**: Single, double, and right-clicks with detailed element information
- **Keystrokes**: Track keyboard interactions (with privacy protections)
- **Mouse Movements & Hovers**: Record cursor position, scroll behavior, and hover events
- **Drag & Drop**: Track drag start, end, and drop events
- **Touch Events**: Comprehensive touch tracking including swipe and pinch gestures
- **Zoom Events**: Monitor zoom interactions on both desktop and mobile devices
- **Page Views**: Track visited pages and time spent

### 🔒 Privacy-First Design
- ✅ All data stored **locally** in your browser
- ✅ **No external servers** or data transmission
- ✅ **Explicit consent** required before tracking
- ✅ **Granular controls** for each tracking type
- ✅ Character keys **masked** to protect passwords
- ✅ Form data **never captured**
- ✅ **Auto-deletion** of data older than 7 days

### 🎨 Beautiful AURA Design
- Modern, gradient-based design with AURA's signature green (#1FB854)
- Real-time statistics dashboard
- Recent interactions viewer
- Easy data export to CSV
- Intuitive toggle controls

### 🌐 Cross-Browser Compatible
- ✅ Chrome 88+
- ✅ Firefox 109+
- ✅ Edge 88+
- ✅ Safari 14+ (with conversion)

## 📦 Installation

> **Important:** This extension now requires a backend server for user authentication and data storage.

### Quick Start (Development)

1. **Start the Backend Server** (See [MONGODB_SETUP.md](MONGODB_SETUP.md) for detailed setup)
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Load Extension in Chrome**
   ```bash
   # Ensure Chrome manifest is active
   copy manifest-chrome.json manifest.json
   ```
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

3. **Create Account & Start Tracking**
   - Click the AURA extension icon
   - Register a new account
   - Grant consent
   - Start tracking!

## 🚀 Complete Setup Guide

For detailed setup instructions including:
- MongoDB configuration (local or Atlas)
- Backend server deployment
- Production environment setup
- API documentation
- Troubleshooting

**See [MONGODB_SETUP.md](MONGODB_SETUP.md)**

---

## 📖 Quick Setup Guide

### Chrome / Edge

1. **Download the Extension**
   - Clone or download this repository
   ```bash
   git clone https://github.com/yourusername/aura-interaction-tracker.git
   cd aura-interaction-tracker
   ```

2. **Prepare Chrome Manifest** (if needed)
   ```bash
   # If manifest.json is currently Firefox version, switch to Chrome
   copy manifest-chrome.json manifest.json
   ```

3. **Load in Chrome/Edge**
   - Open Chrome and navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the extension directory

4. **Start Using**
   - Click the AURA extension icon
   - Accept the consent prompt
   - Enable tracking and enjoy!

### Firefox

1. **Download the Extension**
   ```bash
   git clone https://github.com/yourusername/aura-interaction-tracker.git
   cd aura-interaction-tracker
   ```

2. **Prepare Firefox Manifest** (REQUIRED)
   ```bash
   # Backup Chrome manifest
   copy manifest.json manifest-chrome.json
   
   # Use Firefox-compatible manifest
   copy manifest-firefox.json manifest.json
   ```
   
   **Important:** The file MUST be named `manifest.json` for Firefox to recognize it.

3. **Load Temporary Add-on** (for testing)
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from the extension directory

4. **Start Using**
   - Click the AURA extension icon
   - Accept consent and enable tracking

### Safari

Safari requires additional steps due to its WebExtension implementation:

1. **Prerequisites**
   - macOS Big Sur (11.0) or later
   - Xcode 12 or later (free from App Store)
   - Apple Developer account (free for personal use, $99/year for distribution)

2. **Convert WebExtension to Safari Extension**
   ```bash
   # Open Terminal and navigate to your Desktop or preferred location
   cd ~/Desktop
   
   # Run Safari Web Extension Converter
   xcrun safari-web-extension-converter /path/to/interaction-tracker
   ```

3. **Open in Xcode**
   - Xcode will open automatically
   - Select your development team
   - Build and run (⌘R)

4. **Enable in Safari**
   - Safari will launch with the extension
   - Go to Safari → Preferences → Extensions
   - Enable "User Interaction Tracker"

5. **For Distribution**
   - Archive the app in Xcode
   - Submit to App Store Connect
   - Include a macOS app wrapper (required by Apple)

## 🚀 Usage

### First Launch

1. **Click the extension icon** in your browser toolbar
2. **Read the privacy notice** and understand what data is collected
3. **Click "Accept & Enable Tracking"** to start
4. The extension will begin tracking your interactions

### Managing Tracking

#### Toggle Tracking On/Off
- Use the main toggle switch in the popup
- Tracking can be paused without losing existing data

#### Customize What's Tracked
Select specific interaction types:
- ☑️ Track Clicks
- ☑️ Track Double Clicks
- ☑️ Track Right Clicks
- ☑️ Track Keystrokes
- ☑️ Track Mouse Movements
- ☑️ Track Mouse Hovers
- ☑️ Track Drag & Drop
- ☑️ Track Touch Events (Mobile)
- ☑️ Track Zoom Events (Desktop & Mobile)
- ☑️ Track Page Views

### Viewing Statistics

The popup displays real-time statistics:
- **Total Interactions**: All recorded events
- **Clicks**: Single click events
- **Double Clicks**: Double-click events
- **Right Clicks**: Context menu clicks
- **Keystrokes**: Number of key presses
- **Movements**: Mouse movements and scrolls
- **Hovers**: Mouse enter/leave events
- **Drag & Drop**: Drag and drop operations
- **Touch Events**: Touch interactions including swipes and pinch
- **Zoom Events**: Zoom interactions (keyboard, mouse wheel, pinch)
- **Page Views**: Pages visited

### Recent Interactions

View the last 10 interactions with details:
- Interaction type
- Relevant data (element clicked, key pressed, etc.)
- Timestamp
- Page URL

Click "🔄 Refresh" to update the list.

### Exporting Data

1. Click **"📥 Export Data"**
2. A CSV file will be downloaded with all tracked interactions
3. Open in Excel, Google Sheets, or any CSV viewer
4. Analyze your browsing patterns

### Clearing Data

1. Click **"🗑️ Clear All Data"**
2. Confirm the action
3. All tracked interactions and statistics will be permanently deleted

### Revoking Consent

1. Click **"Revoke Consent & Disable"**
2. Confirm the action
3. All data is deleted and tracking is disabled
4. You'll return to the consent screen

## 🛠️ Technical Details

### Project Structure

```
aura-interaction-tracker/
├── server/                 # Backend API server
│   ├── models/            # MongoDB models
│   │   ├── User.js
│   │   ├── Interaction.js
│   │   └── Stats.js
│   ├── routes/            # API routes
│   │   ├── auth.js        # Authentication endpoints
│   │   ├── interactions.js # Interaction endpoints
│   │   └── stats.js       # Statistics endpoints
│   ├── middleware/        # Express middleware
│   │   └── auth.js        # JWT authentication
│   ├── server.js          # Main server file
│   ├── package.json       # Server dependencies
│   └── .env               # Environment variables
│
├── Extension Files:
├── manifest.json           # Extension configuration (Manifest V3)
├── manifest-chrome.json    # Chrome/Edge specific manifest
├── manifest-firefox.json   # Firefox specific manifest
├── background.js           # Service worker for data processing
├── content.js              # Content script for interaction tracking
├── popup.html              # Extension popup interface
├── popup.js                # Popup logic and UI management
├── popup.css               # AURA-branded popup styles
├── config.js               # API configuration
├── api-client.js           # API helper functions
├── icons/
│   └── logo.png           # AURA logo (used as extension icon)
├── MONGODB_SETUP.md       # Complete setup guide
└── README.md              # This file
```

### Technologies Used

#### Backend
- **Node.js & Express** - Server framework
- **MongoDB & Mongoose** - Database and ODM
- **JWT (jsonwebtoken)** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

#### Extension
- **Manifest V3**: Modern extension format
- **Vanilla JavaScript**: No external dependencies
- **Chrome Storage API**: Local data caching
- **Service Workers**: Background processing
- **Content Scripts**: Page interaction tracking
- **Fetch API**: Backend communication

### Permissions Explained

- `storage`: Cache data locally in browser for offline access
- `activeTab`: Access the currently active tab for tracking
- `<all_urls>`: Track interactions across all websites
- `http://localhost:3000/*`: Connect to local development server
- `https://*.yourdomain.com/*`: Connect to production server

### Data Storage

- **Backend Storage**: MongoDB (persistent, searchable)
- **Local Cache**: Chrome Storage API (temporary, for offline mode)
- **Sync Interval**: Every 30 seconds (configurable)
- **Data Retention**: 30 days (auto-deletion)
- **Maximum Storage**: Unlimited (MongoDB)
- **Security**: JWT authentication, password hashing, user isolation

### Performance Considerations

- **Throttling**: Mouse movements throttled to 500ms
- **Scroll Events**: Throttled to 1000ms
- **Efficient Storage**: Old data automatically pruned
- **Minimal Impact**: Lightweight event listeners

## 🔒 Privacy & Security

### What We Track

✅ Interaction metadata (clicks, keys, movements, hovers, drag & drop, touch events, zoom)  
✅ Page URLs and titles  
✅ Element information (tags, classes, IDs)  
✅ Timestamps  

### What We DON'T Track

❌ Passwords or form field values  
❌ Credit card information  
❌ Personal identifiable information  
❌ Clipboard content  
❌ Authentication tokens  
❌ NO form submissions or form data

### Security Features

- 🔐 **Local storage only** - no network transmission
- 🔐 **Character key masking** - actual characters hidden
- 🔐 **No form data capture** - zero form tracking
- 🔐 **Automatic data expiration** - 7-day retention
- 🔐 **User consent required** - opt-in by default
- 🔐 **Open source** - fully auditable code

For detailed privacy information, see the Privacy Information section in the extension popup.

## 🐛 Troubleshooting

### Extension Not Working

1. **Check if tracking is enabled**
   - Open popup and verify toggle is ON
   - Ensure consent was given

2. **Reload the extension**
   - Chrome/Edge: Go to extensions page → Toggle off/on
   - Firefox: `about:debugging` → Reload

3. **Check browser console**
   - F12 → Console tab
   - Look for error messages

### Data Not Appearing

1. **Refresh the popup**
   - Close and reopen the popup
   - Click the "🔄 Refresh" button

2. **Check storage**
   - Open browser DevTools (F12)
   - Application/Storage tab → Local Storage
   - Look for extension's storage

### Safari-Specific Issues

1. **Extension not appearing**
   - Safari → Preferences → Extensions
   - Enable the extension

2. **Conversion errors**
   - Ensure you're using Xcode 12+
   - Update to latest macOS

3. **Permissions not working**
   - Re-build in Xcode
   - Check Safari's extension permissions

### Performance Issues

1. **Disable mouse movement tracking**
   - Uncheck "Track Mouse Movements" in popup
   - This reduces event frequency

2. **Clear old data**
   - Click "Clear All Data"
   - Or wait for auto-cleanup (7 days)

## 📈 Future Enhancements

Potential features for future versions:

- [ ] Heatmap visualization of clicks and interactions
- [ ] Session recording playback
- [ ] Advanced gesture recognition
- [ ] Cloud sync (optional, with encryption)
- [ ] Advanced filtering and search
- [ ] Custom data retention periods
- [ ] Export to JSON format
- [ ] Statistics charts and graphs with AURA design
- [ ] Website-specific tracking rules
- [ ] Dark mode theme
- [ ] Multi-language support
- [ ] AI-powered interaction insights

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs**
   - Open an issue with detailed description
   - Include browser version and steps to reproduce

2. **Suggest Features**
   - Open an issue with feature proposal
   - Explain use case and benefits

3. **Submit Pull Requests**
   - Fork the repository
   - Create a feature branch
   - Make your changes
   - Test across browsers
   - Submit PR with clear description

4. **Improve Documentation**
   - Fix typos or clarify instructions
   - Add translations
   - Expand troubleshooting guide

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This extension is provided as-is for educational and personal use. Users are responsible for:
- Complying with website terms of service
- Respecting privacy of others
- Using the extension ethically and legally
- Securing exported data

The developers are not responsible for misuse of this extension.

## 🙏 Acknowledgments

- Built with [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/)
- Inspired by analytics and user research tools
- Thanks to the WebExtension community

## 📞 Support

- **Documentation**: See README.md (this file)
- **Issues**: Open an issue on the repository
- **Questions**: Check existing issues or create a new one

## 🌟 Star This Project

If you find this extension useful, please consider giving it a star on GitHub! It helps others discover the project.

---

**Made with ❤️ by AURA - Unleash the Future of UI**

*Last Updated: January 2, 2026*

