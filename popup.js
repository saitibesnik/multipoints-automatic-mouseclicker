// Warte bis das DOM geladen ist
document.addEventListener('DOMContentLoaded', async () => {
  // Tab Handling
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content > div');
  
  // Tab-Wechsel
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Entferne active von allen Tabs und Content
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content > div').forEach(content => content.classList.remove('active'));
      
      // Aktiviere den ausgewählten Tab und Content
      button.classList.add('active');
      const selectedContent = document.getElementById(tabId);
      if (selectedContent) {
        selectedContent.classList.add('active');
      }
      
      // Aktualisiere den Inhalt je nach Tab
      if (tabId === 'positions-tab') {
        chrome.storage.local.get(['positions'], (data) => {
          updatePositionList(data.positions || []);
        });
      } else if (tabId === 'templates') {
        updateTemplateList();
      } else if (tabId === 'logs') {
        chrome.storage.local.get(['logs'], (data) => {
          updateLogList(data.logs || []);
        });
      }
    });
  });

  // Initial aktiven Tab setzen
  const initialTab = document.querySelector('.tab-button.active');
  if (initialTab) {
    initialTab.click();
  }

  // Modal Handling
  const modal = document.getElementById('saveTemplateModal');
  const closeButtons = document.querySelectorAll('.close, .close-modal');
  
  function showModal() {
    modal.classList.add('show');
  }
  
  function hideModal() {
    modal.classList.remove('show');
  }
  
  closeButtons.forEach(button => {
    button.addEventListener('click', hideModal);
  });
  
  // Keep service worker alive
  try {
    await chrome.runtime.sendMessage({ type: 'keepAlive' });
  } catch (e) {
    console.warn('Service worker not ready yet');
  }

  // Logging function
  function addLogEntry(action, details) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const entry = {
      time: timeStr,
      action: action,
      details: details,
      timestamp: now.getTime()
    };

    chrome.storage.local.get(['logs'], (data) => {
      const logs = data.logs || [];
      logs.push(entry);
      // Keep only the last 100 entries
      if (logs.length > 100) logs.shift();
      chrome.storage.local.set({ logs }, () => {
        updateLogList(logs);
      });
    });
  }

  function updateLogList(logs = []) {
    const tbody = document.getElementById('logEntries');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
        <td>${log.action}</td>
        <td>${log.details}</td>
      </tr>
    `).join('');
  }

  // Log löschen
  document.getElementById('clearLog').addEventListener('click', () => {
    if (confirm('Möchten Sie wirklich den gesamten Log löschen?')) {
      chrome.storage.local.set({ logs: [] }, () => {
        updateLogList([]);
        updateStatus('Log wurde gelöscht', 'success');
      });
    }
  });

  // Template functions
  function updateTemplateList() {
    chrome.storage.local.get(['templates'], (data) => {
      const templates = data.templates || [];
      const templateList = document.getElementById('templateList');
      const noTemplates = document.getElementById('noTemplates');
      
      if (templates.length === 0) {
        noTemplates.style.display = 'block';
        templateList.innerHTML = '';
        return;
      }
      
      noTemplates.style.display = 'none';
      templateList.innerHTML = templates.map((template, index) => `
        <div class="template-item">
          <div class="template-info">
            <strong>${template.name}</strong>
            <small>${template.positions.length} Positionen</small>
          </div>
          <div class="template-actions">
            <button class="btn btn-sm btn-primary load-template" data-index="${index}">
              Laden
            </button>
            <button class="btn btn-sm btn-danger delete-template" data-index="${index}">
              Löschen
            </button>
          </div>
        </div>
      `).join('');
      
      // Event-Listener für Template-Aktionen
      templateList.querySelectorAll('.load-template').forEach(button => {
        button.addEventListener('click', () => {
          const index = parseInt(button.dataset.index);
          chrome.storage.local.set({ positions: templates[index].positions }, () => {
            updatePositionList(templates[index].positions);
            addLogEntry('Template geladen', `Template "${templates[index].name}" mit ${templates[index].positions.length} Positionen`);
            // Wechsle zum Positions-Tab
            document.querySelector('[data-tab="positions-tab"]').click();
          });
        });
      });
      
      templateList.querySelectorAll('.delete-template').forEach(button => {
        button.addEventListener('click', () => {
          const index = parseInt(button.dataset.index);
          templates.splice(index, 1);
          chrome.storage.local.set({ templates }, () => {
            updateTemplateList();
            addLogEntry('Template gelöscht', `Template an Position ${index + 1}`);
          });
        });
      });
    });
  }

  // Template speichern
  document.getElementById('saveTemplate').addEventListener('click', () => {
    chrome.storage.local.get(['positions', 'templates'], (data) => {
      const positions = data.positions || [];
      const templates = data.templates || [];
      
      if (positions.length === 0) {
        updateStatus('Keine Positionen zum Speichern vorhanden', 'warning');
        return;
      }
      
      const name = prompt('Name für das Template:');
      if (!name) return;
      
      templates.push({ name, positions: [...positions] });
      chrome.storage.local.set({ templates }, () => {
        updateTemplateList();
        addLogEntry('Template gespeichert', `"${name}" mit ${positions.length} Positionen`);
        updateStatus('Template gespeichert', 'success');
        
        // Wechsle zum Template-Tab und zeige das neue Template
        document.querySelector('[data-tab="templates"]').click();
      });
    });
  });

  // Save template modal button
  document.getElementById('saveTemplateBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('templateName');
    const descInput = document.getElementById('templateDescription');
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      alert('Bitte geben Sie einen Namen für das Template ein.');
      return;
    }

    chrome.storage.local.get(['positions', 'templates'], (data) => {
      const positions = data.positions || [];
      const templates = data.templates || [];
      
      if (positions.length === 0) {
        alert('Keine Positionen zum Speichern vorhanden.');
        return;
      }

      const template = {
        id: Date.now().toString(),
        name: name,
        description: description,
        positions: positions,
        created: Date.now()
      };

      templates.push(template);
      chrome.storage.local.set({ templates }, () => {
        updateTemplateList(templates);
        addLogEntry('Template erstellt', `Neues Template "${name}" erstellt`);
        hideModal();
        nameInput.value = '';
        descInput.value = '';
      });
    });
  });

  document.getElementById('record').addEventListener('click', () => {
    // Aktiviere den Aufnahmemodus
    document.body.classList.add('recording');
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentTab = tabs[0];
      
      // Führe das Skript aus
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: () => {
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
              resolve(position);
            };
            
            document.addEventListener('click', clickHandler, true);
          });
        }
      }).then((results) => {
        if (results && results[0] && results[0].result) {
          const position = results[0].result;
          try {
            chrome.storage.local.get(['positions'], (data) => {
              const positions = data.positions || [];
              positions.push(position);
              chrome.storage.local.set({ positions }, () => {
                updatePositionList(positions);
                addLogEntry('Position hinzugefügt', 
                  `${position.tagName} ${position.text ? `(${position.text})` : ''} at (${position.x}, ${position.y})`);
                // Deaktiviere den Aufnahmemodus
                document.body.classList.remove('recording');
              });
            });
          } catch (e) {
            console.error('Storage error:', e);
            updateStatus("Fehler beim Speichern der Position", "danger");
            document.body.classList.remove('recording');
          }
        }
      }).catch(error => {
        console.error('Script execution error:', error);
        updateStatus("Fehler beim Aufzeichnen der Position", "danger");
        document.body.classList.remove('recording');
      });
    });
  });

  document.getElementById('recordTab').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tab = tabs[0];
      chrome.storage.local.get(['positions'], (data) => {
        const positions = data.positions || [];
        positions.push({
          type: 'tab',
          tabId: tab.id,
          title: tab.title,
          url: tab.url
        });
        chrome.storage.local.set({ positions }, () => {
          updatePositionList(positions);
          addLogEntry('Tab gespeichert', `Tab "${tab.title}" wurde zur Sequenz hinzugefügt`);
        });
      });
    });
  });

  document.getElementById('start').addEventListener('click', () => {
    const interval = document.getElementById('interval').value || 1000;
    try {
      chrome.storage.local.get(['positions'], (data) => {
        if (!data.positions || data.positions.length === 0) {
          updateStatus("Keine Positionen gespeichert!", "danger");
          return;
        }
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content_script.js']
          }).then(() => {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              function: (positions, interval) => {
                return window.startAutoClicker(positions, interval);
              },
              args: [data.positions, parseInt(interval)]
            }).then((results) => {
              if (results && results[0] && results[0].result) {
                updateStatus("Auto Clicker läuft", "success");
                addLogEntry('Auto Clicker gestartet', 
                  `Interval: ${interval}ms, Positionen: ${data.positions.length}`);
                startStatusCheck();
              }
            });
          });
        });
      });
    } catch (e) {
      console.error('Start error:', e);
      updateStatus("Fehler beim Starten", "danger");
    }
  });

  document.getElementById('stop').addEventListener('click', () => {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: () => {
            return window.stopAutoClicker();
          }
        }).then((results) => {
          if (results && results[0] && results[0].result) {
            updateStatus("Gestoppt", "warning");
            addLogEntry('Auto Clicker gestoppt', 'Automatisches Klicken wurde beendet');
            if (statusInterval) {
              clearInterval(statusInterval);
              statusInterval = null;
            }
          }
        });
      });
    } catch (e) {
      console.error('Stop error:', e);
      updateStatus("Fehler beim Stoppen", "danger");
    }
  });

  document.getElementById('clear').addEventListener('click', () => {
    try {
      chrome.storage.local.get(['positions'], (data) => {
        const count = (data.positions || []).length;
        chrome.storage.local.set({ positions: [] }, () => {
          updatePositionList([]);
          updateStatus("Liste geleert", "info");
          if (count > 0) {
            addLogEntry('Positionen gelöscht', `${count} Positionen wurden gelöscht`);
          }
        });
      });
    } catch (e) {
      console.error('Clear error:', e);
      updateStatus("Fehler beim Löschen", "danger");
    }
  });

  let statusInterval = null;

  function startStatusCheck() {
    if (statusInterval) return;
    
    statusInterval = setInterval(() => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: () => {
              return window.isRunning;
            }
          }).then((results) => {
            if (results && results[0] && results[0].result) {
              updateStatus("Auto Clicker läuft", "success");
            } else {
              updateStatus("Gestoppt", "warning");
              clearInterval(statusInterval);
              statusInterval = null;
            }
          }).catch(() => {
            updateStatus("Status unbekannt", "warning");
            clearInterval(statusInterval);
            statusInterval = null;
          });
        }
      });
    }, 1000);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'autoClickerStopped') {
      updateStatus("Gestoppt (ESC gedrückt)", "warning");
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
    }
  });

  function updateStatus(text, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = text;
    statusElement.className = `status-${type}`;
  }

  function updatePositionList(positions) {
    const list = document.getElementById('positions-list');
    if (!list) return;

    list.innerHTML = positions.map((pos, index) => {
      let details = '';
      if (pos.type === 'tab') {
        details = `Tab: ${pos.title}`;
      } else {
        details = `${pos.tagName} ${pos.text ? `(${pos.text})` : ''} at (${pos.x}, ${pos.y})`;
      }

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${pos.type || 'Klick'}</td>
          <td>${details}</td>
          <td>
            <button class="btn btn-sm btn-danger delete-position" data-index="${index}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Event-Listener für Lösch-Buttons
    list.querySelectorAll('.delete-position').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.dataset.index);
        positions.splice(index, 1);
        chrome.storage.local.set({ positions }, () => {
          updatePositionList(positions);
          addLogEntry('Position gelöscht', `Position ${index + 1}`);
        });
      });
    });
  }

  // Initial load
  try {
    chrome.storage.local.get(['positions', 'templates', 'logs'], (data) => {
      updatePositionList(data.positions || []);
      updateTemplateList();
      updateLogList(data.logs || []);
    });
  } catch (e) {
    console.error('Initial load error:', e);
    updateStatus("Fehler beim Laden der Daten", "danger");
  }
});