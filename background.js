// Background script for Enhanced Test Automation Recorder
console.log('Enhanced Test Automation Recorder background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      'recorderSettings': {
        'autoHighlight': false,
        'xpathPreview': true,
        'smartWaits': true,
        'salesforceMode': false,
        'theme': 'light'
      }
    });
    
    console.log('Enhanced Test Automation Recorder installed successfully');
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'getSettings':
      chrome.storage.sync.get(['recorderSettings'], (result) => {
        sendResponse(result.recorderSettings || {});
      });
      return true; // Will respond asynchronously
      
    case 'saveSettings':
      chrome.storage.sync.set({
        'recorderSettings': request.settings
      }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'injectRecorder':
      // Forward injection request to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'injectRecorder' })
            .then((response) => {
              sendResponse(response);
            })
            .catch((error) => {
              console.error('Error injecting recorder:', error);
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true;
      
    case 'checkRecorderStatus':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'checkRecorderStatus' })
            .then((response) => {
              sendResponse(response);
            })
            .catch((error) => {
              console.error('Error checking recorder status:', error);
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true;
      
    case 'updateRecordingStatus':
      // Handle recording status updates
      if (request.isRecording) {
        updateBadge('REC', '#e74c3c');
      } else if (request.stepCount > 0) {
        updateBadge(request.stepCount.toString(), '#27ae60');
      } else {
        updateBadge('');
      }
      sendResponse({ success: true });
      break;
      
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle tab updates (page navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
    
    // Send message to content script about page change
    chrome.tabs.sendMessage(tabId, {
      action: 'pageUpdated',
      url: tab.url
    }).catch((error) => {
      // Ignore errors if content script not loaded
      console.log('Content script not ready for tab:', tabId);
    });
  }
});

// Context menu integration
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing context menus first
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'launchRecorder',
      title: 'Launch Test Recorder',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'recordElement',
      title: 'Record This Element',
      contexts: ['all']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'launchRecorder':
      chrome.tabs.sendMessage(tab.id, { action: 'injectRecorder' })
        .catch((error) => {
          console.error('Error launching recorder from context menu:', error);
        });
      break;
      
    case 'recordElement':
      chrome.tabs.sendMessage(tab.id, { 
        action: 'recordSpecificElement',
        elementInfo: info
      }).catch((error) => {
        console.error('Error recording element from context menu:', error);
      });
      break;
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      let action;
      switch (command) {
        case 'toggle-recorder':
          action = 'toggleRecorder';
          break;
        case 'start-recording':
          action = 'startRecording';
          break;
        case 'stop-recording':
          action = 'stopRecording';
          break;
        default:
          console.log('Unknown command:', command);
          return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: action })
        .catch((error) => {
          console.error(`Error executing command ${command}:`, error);
        });
    }
  });
});

// Badge management
function updateBadge(text, color = '#667eea') {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
}

// Storage management
function getStorageUsage() {
  chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
    console.log('Storage usage:', bytesInUse, 'bytes');
    
    // Warn if storage is getting full (> 4MB for local storage)
    if (bytesInUse > 4 * 1024 * 1024) {
      console.warn('Storage usage is high. Consider cleaning up old recordings.');
    }
  });
}

// Cleanup old data (run periodically)
function cleanupOldData() {
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  chrome.storage.local.get(null, (items) => {
    const keysToRemove = [];
    
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith('recording_') && 
          value && 
          value.timestamp && 
          value.timestamp < oneWeekAgo) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log('Cleaned up old recordings:', keysToRemove.length);
      });
    }
  });
}

// Periodic cleanup (run every hour)
setInterval(cleanupOldData, 60 * 60 * 1000);

// Run cleanup on startup
cleanupOldData();

// Check storage usage periodically
setInterval(getStorageUsage, 30 * 60 * 1000); // Every 30 minutes

// Handle extension unload
chrome.runtime.onSuspend.addListener(() => {
  console.log('Background script suspending...');
  // Perform any cleanup here
});

// Enhanced error handling
self.addEventListener('error', (event) => {
  console.error('Background script error:', {
    message: event.error.message,
    stack: event.error.stack,
    filename: event.filename,
    lineno: event.lineno
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    stack: event.reason?.stack
  });
  event.preventDefault(); // Prevent the default handling
});

// Function to check if content script is loaded
async function isContentScriptLoaded(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.success;
  } catch (error) {
    return false;
  }
}

// Function to inject content script if needed
async function ensureContentScript(tabId) {
  const isLoaded = await isContentScriptLoaded(tabId);
  
  if (!isLoaded) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('Content script injected into tab:', tabId);
      return true;
    } catch (error) {
      console.error('Failed to inject content script:', error);
      return false;
    }
  }
  
  return true;
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateBadge,
    cleanupOldData,
    getStorageUsage,
    isContentScriptLoaded,
    ensureContentScript
  };
}

console.log('Enhanced Test Automation Recorder background script ready');