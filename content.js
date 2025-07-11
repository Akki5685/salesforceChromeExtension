// Content script for Enhanced Test Automation Recorder
console.log('Test Recorder content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  switch (request.action) {
    case 'ping':
      sendResponse({ success: true, message: 'Content script is ready' });
      break;
      
    case 'injectRecorder':
      // The recorder is injected directly from popup.js
      sendResponse({ success: true, message: 'Recorder injection handled by popup' });
      break;
      
    case 'checkRecorderStatus':
      const recorderExists = document.getElementById('enhanced-test-recorder-container') !== null;
      const isRecording = window.recorderState ? window.recorderState.isRecording : false;
      const stepCount = window.recorderState ? window.recorderState.steps.length : 0;
      
      sendResponse({ 
        success: true, 
        recorderExists,
        isRecording,
        stepCount
      });
      break;
      
    case 'toggleRecorder':
      if (window.recorderState) {
        const startBtn = document.querySelector('#startRecording');
        const pauseBtn = document.querySelector('#pauseRecording');
        
        if (window.recorderState.isRecording) {
          pauseBtn?.click();
        } else {
          startBtn?.click();
        }
        sendResponse({ success: true, message: 'Recorder toggled' });
      } else {
        sendResponse({ success: false, message: 'Recorder not found' });
      }
      break;
      
    case 'startRecording':
      if (window.recorderState) {
        document.querySelector('#startRecording')?.click();
        sendResponse({ success: true, message: 'Recording started' });
      } else {
        sendResponse({ success: false, message: 'Recorder not found' });
      }
      break;
      
    case 'stopRecording':
      if (window.recorderState) {
        document.querySelector('#pauseRecording')?.click();
        sendResponse({ success: true, message: 'Recording stopped' });
      } else {
        sendResponse({ success: false, message: 'Recorder not found' });
      }
      break;
      
    case 'pageUpdated':
      console.log('Page updated:', request.url);
      // Handle page navigation - recorder state is maintained
      sendResponse({ success: true });
      break;
      
    case 'recordSpecificElement':
      // Handle context menu element recording
      if (window.recorderState && window.recorderState.isRecording) {
        console.log('Recording specific element from context menu');
        sendResponse({ success: true, message: 'Element recorded' });
      } else {
        sendResponse({ success: false, message: 'Recorder not recording' });
      }
      break;
      
    default:
      console.log('Unknown action in content script:', request.action);
      sendResponse({ success: false, message: 'Unknown action' });
  }
  
  return true; // Will respond asynchronously
});

// Notify background script when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ 
      action: 'pageLoaded', 
      url: window.location.href 
    }).catch(() => {
      // Ignore errors if background script isn't ready
    });
  });
} else {
  chrome.runtime.sendMessage({ 
    action: 'pageLoaded', 
    url: window.location.href 
  }).catch(() => {
    // Ignore errors if background script isn't ready
  });
}

// Handle recorder state persistence across page reloads
window.addEventListener('beforeunload', () => {
  if (window.recorderState && window.recorderState.steps.length > 0) {
    // Save state to local storage
    try {
      localStorage.setItem('recorderState', JSON.stringify({
        steps: window.recorderState.steps,
        stepCounter: window.recorderState.stepCounter,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Could not save recorder state:', error);
    }
  }
});

// Restore recorder state if available
window.addEventListener('load', () => {
  try {
    const savedState = localStorage.getItem('recorderState');
    if (savedState) {
      const state = JSON.parse(savedState);
      
      // Only restore if saved recently (within 1 hour)
      if (Date.now() - state.timestamp < 3600000) {
        console.log('Restored recorder state with', state.steps.length, 'steps');
        
        if (window.recorderState) {
          window.recorderState.steps = state.steps || [];
          window.recorderState.stepCounter = state.stepCounter || 0;
        }
      }
    }
  } catch (error) {
    console.warn('Could not restore recorder state:', error);
  }
});

console.log('Enhanced Test Recorder content script ready');