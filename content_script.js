let clickInterval = null;
let isRunning = false;

// Funktion zum Simulieren eines Klicks
function simulateClick(position) {
  if (position.type === 'tab') {
    // Aktiviere den gespeicherten Tab
    chrome.runtime.sendMessage({ 
      type: 'activateTab', 
      tabId: position.tabId 
    });
    return;
  }

  const element = document.elementFromPoint(position.x, position.y);
  if (element) {
    element.click();
  }
}

// Funktion zum Aufzeichnen einer Position
function recordPosition() {
  return new Promise((resolve) => {
    document.body.style.cursor = 'crosshair';
    
    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const position = {
        x: e.clientX,
        y: e.clientY,
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        text: element.textContent?.trim()
      };
      
      document.body.style.cursor = 'default';
      document.removeEventListener('click', clickHandler, true);
      
      // Speichere die Position
      chrome.storage.local.get(['positions'], (data) => {
        const positions = data.positions || [];
        positions.push(position);
        chrome.storage.local.set({ positions }, () => {
          // Benachrichtige den Background Service
          chrome.runtime.sendMessage({
            type: 'positionAdded',
            position: position,
            totalPositions: positions.length
          });
          resolve(position);
        });
      });
    };
    
    document.addEventListener('click', clickHandler, true);
  });
}

// Funktion zum Starten des Auto-Clickers
function startAutoClicker(positions, interval) {
  if (isRunning || !positions || positions.length === 0) return false;
  
  isRunning = true;
  let currentIndex = 0;
  
  clickInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(clickInterval);
      return;
    }
    
    simulateClick(positions[currentIndex]);
    currentIndex = (currentIndex + 1) % positions.length;
  }, interval);
  
  return true;
}

// Funktion zum Stoppen des Auto-Clickers
function stopAutoClicker() {
  if (!isRunning) return false;
  
  isRunning = false;
  if (clickInterval) {
    clearInterval(clickInterval);
    clickInterval = null;
  }
  
  return true;
}

// Hotkey-Handler hinzufügen (Escape-Taste zum Stoppen)
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && isRunning) {
    stopAutoClicker();
    // Benachrichtige das Popup über den Stop
    chrome.runtime.sendMessage({ type: 'autoClickerStopped' });
  }
});

// Listener für Nachrichten vom Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getStatus') {
    sendResponse({ isRunning });
  } else if (message.type === 'recordPosition') {
    recordPosition().then(position => {
      sendResponse({ success: true, position });
    });
    return true; // Wichtig für asynchrone Antwort
  }
});

// Exportiere die Funktionen für das Popup
window.startAutoClicker = startAutoClicker;
window.stopAutoClicker = stopAutoClicker;
window.isRunning = isRunning;