// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with empty positions array
  chrome.storage.local.set({ positions: [] });
});

// Keep the service worker active
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'keepAlive') {
    sendResponse({ status: 'alive' });
  }
  return true;
});

// Listener für Tab-Aktivierung
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'activateTab') {
    chrome.tabs.update(message.tabId, { active: true });
  } else if (message.type === 'positionAdded') {
    // Zeige eine Benachrichtigung an
    chrome.action.setBadgeText({ 
      text: message.totalPositions.toString() 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#28a745' 
    });
    
    // Aktualisiere den Badge nach 2 Sekunden
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2000);
  }
});
