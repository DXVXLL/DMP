

/* 1. Константы и глобальные переменные */


const toolLoc = document.getElementById('tool-loc');
const toolRoad = document.getElementById('tool-road');
const toolDelete = document.getElementById('tool-delete');
const workspace = document.getElementById('workspace');
const roadsSvg = document.getElementById('roads-svg');

const tabAssetsBtn = document.getElementById('tab-assets-btn');
const tabSettingsBtn = document.getElementById('tab-settings-btn');
const contentAssets = document.getElementById('content-assets');
const contentSettings = document.getElementById('content-settings');

const roadSettingsContainer = document.getElementById('road-settings');
const nodeSettingsContainer = document.getElementById('node-settings');
const emptySettingsMsg = document.getElementById('settings-empty-msg');

const roadTypeSelect = document.getElementById('road-type');
const roadColorSelect = document.getElementById('road-color');
const nodeColorSelect = document.getElementById('node-color');
const nodeIconSelect = document.getElementById('node-icon');

let isLocToolActive = false; 
let isRoadToolActive = false; 
let isDeleteToolActive = false; 

let roadStartNode = null;
let selectedRoad = null;
let selectedNode = null;

let draggedNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

const gridSize = 60;
const nodeSize = 120;

const ghostNode = document.createElement('div');
ghostNode.classList.add('map-node-preview');
workspace.appendChild(ghostNode);


/* 2. Управление боковой панелью */


function switchTab(tabName) {
  if (tabName === 'assets') {
    tabAssetsBtn.classList.add('active');
    tabSettingsBtn.classList.remove('active');
    contentAssets.classList.add('active');
    contentSettings.classList.remove('active');
  } else if (tabName === 'settings') {
    tabSettingsBtn.classList.add('active');
    tabAssetsBtn.classList.remove('active');
    contentSettings.classList.add('active');
    contentAssets.classList.remove('active');
  }
}

tabAssetsBtn.addEventListener('click', () => switchTab('assets'));
tabSettingsBtn.addEventListener('click', () => switchTab('settings'));


/* 3. Вспомогательные функции и сетка */


function getSnappedCoords(rawX, rawY) {
  const snappedX = Math.floor((rawX - nodeSize / 2) / gridSize) * gridSize;
  const snappedY = Math.floor((rawY - nodeSize / 2) / gridSize) * gridSize;
  return { x: snappedX, y: snappedY };
}

function applyRoadStyles(road) {
  const type = road.getAttribute('data-type') || 'normal';
  const color = road.getAttribute('data-color') || '#000000';

  road.classList.remove('type-dashed', 'type-wide');
  
  if (type === 'dashed') road.classList.add('type-dashed');
  if (type === 'wide') road.classList.add('type-wide');

  if (!road.classList.contains('selected-road')) {
    road.style.stroke = color;
  }
}

function resetSelection() {
  if (selectedRoad) {
    selectedRoad.classList.remove('selected-road');
    selectedRoad.style.stroke = selectedRoad.getAttribute('data-color');
    selectedRoad = null;
  }
  if (selectedNode) {
    selectedNode.classList.remove('selected-node');
    selectedNode = null;
  }
  roadSettingsContainer.style.display = 'none';
  nodeSettingsContainer.style.display = 'none';
  emptySettingsMsg.style.display = 'block';
}


/* 4. Функция поиска пути */


function findSmartPath(startX, startY, endX, endY, customNodeCoords = null) {
  const startGrid = { x: Math.round(startX / gridSize), y: Math.round(startY / gridSize) };
  const endGrid = { x: Math.round(endX / gridSize), y: Math.round(endY / gridSize) };

  const blockedCells = new Set();
  const bufferCells = new Set();

  document.querySelectorAll('.map-node').forEach(node => {
    let nX = parseInt(node.style.left);
    let nY = parseInt(node.style.top);

    if (customNodeCoords && node.id === customNodeCoords.id) {
      nX = customNodeCoords.x;
      nY = customNodeCoords.y;
    }

    const gX = Math.round(nX / gridSize);
    const gY = Math.round(nY / gridSize);

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        blockedCells.add(`${gX + x},${gY + y}`);
      }
    }

    for (let x = -1; x <= 2; x++) {
      for (let y = -1; y <= 2; y++) {
        const key = `${gX + x},${gY + y}`;
        if (!blockedCells.has(key)) {
          bufferCells.add(key);
        }
      }
    }
  });

  const isStartOrEnd = (x, y) => {
    return (x >= startGrid.x - 1 && x <= startGrid.x + 2 && y >= startGrid.y - 1 && y <= startGrid.y + 2) ||
           (x >= endGrid.x - 1 && x <= endGrid.x + 2 && y >= endGrid.y - 1 && y <= endGrid.y + 2);
  };

  const queue = [ { x: startGrid.x, y: startGrid.y, cost: 0 } ];
  const distances = {};
  const parentMap = {};
  
  const startKey = `${startGrid.x},${startGrid.y}`;
  distances[startKey] = 0;

  const directions = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
  ];

  const minX = Math.min(startGrid.x, endGrid.x) - 15;
  const maxX = Math.max(startGrid.x, endGrid.x) + 15;
  const minY = Math.min(startGrid.y, endGrid.y) - 15;
  const maxY = Math.max(startGrid.y, endGrid.y) + 15;

  let found = false;

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    const cx = current.x;
    const cy = current.y;
    const currentKey = `${cx},${cy}`;

    if (cx === endGrid.x && cy === endGrid.y) {
      found = true;
      break;
    }

    if (current.cost > distances[currentKey]) continue;

    for (const dir of directions) {
      const nx = cx + dir.x;
      const ny = cy + dir.y;
      const nextKey = `${nx},${ny}`;

      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      if (blockedCells.has(nextKey) && !isStartOrEnd(nx, ny)) continue;

      let moveCost = 1; 
      if (bufferCells.has(nextKey) && !isStartOrEnd(nx, ny)) {
        moveCost = 5; 
      }

      const newCost = current.cost + moveCost;

      if (distances[nextKey] === undefined || newCost < distances[nextKey]) {
        distances[nextKey] = newCost;
        parentMap[nextKey] = currentKey;
        queue.push({ x: nx, y: ny, cost: newCost });
      }
    }
  }

  const points = [];
  if (found) {
    let currentKey = `${endGrid.x},${endGrid.y}`;
    while (currentKey) {
      const [gridX, gridY] = currentKey.split(',').map(Number);
      points.unshift(`${gridX * gridSize},${gridY * gridSize}`);
      currentKey = parentMap[currentKey];
    }
  } else {
    points.push(`${startX},${startY}`);
    points.push(`${startX},${endY}`);
    points.push(`${endX},${endY}`);
  }

  return points.join(' ');
}

function updateNodeRoads(node, customX = null, customY = null) {
  const nodeId = node.id;
  const connectedRoads = document.querySelectorAll(`.map-road[data-from="${nodeId}"], .map-road[data-to="${nodeId}"]`);

  connectedRoads.forEach(road => {
    road.classList.remove('road-appearing', 'road-dashed-appearing');

    const fromId = road.getAttribute('data-from');
    const toId = road.getAttribute('data-to');

    const nodeA = document.getElementById(fromId);
    const nodeB = document.getElementById(toId);

    if (nodeA && nodeB) {
      const xA = (nodeA === node ? (customX !== null ? customX : parseInt(nodeA.style.left)) : parseInt(nodeA.style.left));
      const yA = (nodeA === node ? (customY !== null ? customY : parseInt(nodeA.style.top)) : parseInt(nodeA.style.top));
      
      const xB = (nodeB === node ? (customX !== null ? customX : parseInt(nodeB.style.left)) : parseInt(nodeB.style.left));
      const yB = (nodeB === node ? (customY !== null ? customY : parseInt(nodeB.style.top)) : parseInt(nodeB.style.top));

      const cXA = xA + nodeSize / 2;
      const cYA = yA + nodeSize / 2;
      const cXB = xB + nodeSize / 2;
      const cYB = yB + nodeSize / 2;

      const customCoordsInfo = (customX !== null) ? { id: node.id, x: customX, y: customY } : null;
      const smartPoints = findSmartPath(cXA, cYA, cXB, cYB, customCoordsInfo);
      
      road.setAttribute('points', smartPoints);
    }
  });
}


/* 5. Создание объектов */


function createNodeOnWorkspace(id, left, top, text = 'Локация', color = '#ffffff', icon = '') {
  const newNode = document.createElement('div');
  newNode.classList.add('map-node');
  newNode.style.left = left;
  newNode.style.top = top;
  newNode.style.backgroundColor = color;
  newNode.id = id;
  newNode.setAttribute('data-color', color);
  newNode.setAttribute('data-icon', icon);
  
  const iconDiv = document.createElement('div');
  iconDiv.classList.add('node-icon-display');
  iconDiv.textContent = icon;
  newNode.appendChild(iconDiv);
  
  const textDiv = document.createElement('div');
  textDiv.classList.add('node-text');
  textDiv.textContent = text;
  newNode.appendChild(textDiv);

  newNode.addEventListener('click', function(event) {
    if (isLocToolActive || isRoadToolActive || isDeleteToolActive) return;
    event.stopPropagation(); 

    resetSelection();

    selectedNode = newNode;
    selectedNode.classList.add('selected-node');

    switchTab('settings');
    emptySettingsMsg.style.display = 'none';
    roadSettingsContainer.style.display = 'none';
    nodeSettingsContainer.style.display = 'block';

    nodeColorSelect.value = selectedNode.getAttribute('data-color') || '#ffffff';
    nodeIconSelect.value = selectedNode.getAttribute('data-icon') || '';
  });

  newNode.addEventListener('mousedown', function(event) {
    if (isLocToolActive || isRoadToolActive || isDeleteToolActive) return;
    if (event.target.tagName === 'INPUT') return;

    draggedNode = newNode;
    
    const rect = workspace.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left - parseInt(newNode.style.left);
    dragOffsetY = event.clientY - rect.top - parseInt(newNode.style.top);

    newNode.style.zIndex = '1000';
    newNode.style.opacity = '0.6';
    
    ghostNode.style.display = 'block';
    ghostNode.style.left = newNode.style.left;
    ghostNode.style.top = newNode.style.top;

    event.stopPropagation();
  });

  textDiv.addEventListener('dblclick', function(event) {
    event.stopPropagation();
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('node-input');
    input.value = textDiv.textContent;
    newNode.replaceChild(input, textDiv);
    input.focus();
    input.select();

    function saveText() {
      const newValue = input.value.trim();
      if (newValue !== '') textDiv.textContent = newValue;
      if (input.parentNode === newNode) newNode.replaceChild(textDiv, input);
      saveMap();
    }
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') saveText(); });
    input.addEventListener('blur', saveText);
  });
  
  workspace.appendChild(newNode);
}

function triggerRoadAnimation(polyline) {
  const length = polyline.getTotalLength() || 200; 
  const type = polyline.getAttribute('data-type') || 'normal';

  if (type === 'dashed') {
    const patternRepeats = Math.ceil(length / 24) + 2;
    let dashPattern = "";
    for (let i = 0; i < patternRepeats; i++) {
      dashPattern += "10 14 ";
    }
    polyline.style.strokeDasharray = `${dashPattern} ${length}`;
    polyline.style.strokeDashoffset = length;
    polyline.style.animationDelay = '1.6s'; 
    
    polyline.getBoundingClientRect(); 
    polyline.classList.add('road-dashed-appearing');
  } else {
    polyline.style.strokeDasharray = length;
    polyline.style.strokeDashoffset = length;
    polyline.style.animationDelay = '0.4s'; 
    
    polyline.getBoundingClientRect(); 
    polyline.classList.add('road-appearing');
  }
  
  polyline.addEventListener('animationend', function() {
    polyline.classList.remove('road-appearing', 'road-dashed-appearing');
    polyline.style.strokeDasharray = '';
    polyline.style.strokeDashoffset = '';
    polyline.style.animationDelay = '';
    applyRoadStyles(polyline);
  }, { once: true });
}

function drawRoad(nodeA, nodeB, skipAnimation = false) {
  const xA = parseInt(nodeA.style.left);
  const yA = parseInt(nodeA.style.top);
  const xB = parseInt(nodeB.style.left);
  const yB = parseInt(nodeB.style.top);

  const centerXA = xA + 60;
  const centerYA = yA + 60;
  const centerXB = xB + 60;
  const centerYB = yB + 60;

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.classList.add('map-road');
  polyline.setAttribute('data-from', nodeA.id);
  polyline.setAttribute('data-to', nodeB.id);
  polyline.setAttribute('data-type', 'normal');
  polyline.setAttribute('data-color', '#000000');
  polyline.style.pointerEvents = 'auto';

  const smartPoints = findSmartPath(centerXA, centerYA, centerXB, centerYB);
  polyline.setAttribute('points', smartPoints);

  polyline.addEventListener('click', function(event) {
    if (isLocToolActive || isRoadToolActive || isDeleteToolActive) return;
    event.stopPropagation(); 
    
    resetSelection();

    selectedRoad = polyline;
    selectedRoad.classList.add('selected-road');

    switchTab('settings');
    emptySettingsMsg.style.display = 'none';
    nodeSettingsContainer.style.display = 'none';
    roadSettingsContainer.style.display = 'block';

    roadTypeSelect.value = selectedRoad.getAttribute('data-type') || 'normal';
    roadColorSelect.value = selectedRoad.getAttribute('data-color') || '#000000';
  });

  roadsSvg.appendChild(polyline);
  applyRoadStyles(polyline);

  if (!skipAnimation) {
    requestAnimationFrame(() => {
      triggerRoadAnimation(polyline);
    });
  }

  return polyline;
}


/* 6. Движения мыши */


document.addEventListener('mousemove', function(event) {
  if (draggedNode) {
    const rect = workspace.getBoundingClientRect();
    let rawX = event.clientX - rect.left - dragOffsetX;
    let rawY = event.clientY - rect.top - dragOffsetY;

    if (rawX < 0) rawX = 0;
    if (rawY < 0) rawY = 0;
    if (rawX > 3000 - nodeSize) rawX = 3000 - nodeSize;
    if (rawY > 3000 - nodeSize) rawY = 3000 - nodeSize;

    draggedNode.style.left = rawX + 'px';
    draggedNode.style.top = rawY + 'px';

    const targetCoords = getSnappedCoords(rawX + nodeSize / 2, rawY + nodeSize / 2);

    ghostNode.style.left = targetCoords.x + 'px';
    ghostNode.style.top = targetCoords.y + 'px';

    updateNodeRoads(draggedNode, targetCoords.x, targetCoords.y);
    return;
  }

  if (!isLocToolActive) return;
  const rect = workspace.getBoundingClientRect();
  const rawX = event.clientX - rect.left;
  const rawY = event.clientY - rect.top;
  const coords = getSnappedCoords(rawX, rawY);

  ghostNode.style.display = 'block';
  ghostNode.style.left = coords.x + 'px';
  ghostNode.style.top = coords.y + 'px';
});

document.addEventListener('mouseup', function() {
  if (draggedNode) {
    const currentX = parseInt(draggedNode.style.left);
    const currentY = parseInt(draggedNode.style.top);
    const coords = getSnappedCoords(currentX + nodeSize / 2, currentY + nodeSize / 2);

    const existingNodes = document.querySelectorAll('.map-node');
    let isOverlap = false;
    existingNodes.forEach(node => {
      if (node === draggedNode) return;
      const nodeLeft = parseInt(node.style.left);
      const nodeTop = parseInt(node.style.top);
      if (coords.x < nodeLeft + nodeSize && coords.x + nodeSize > nodeLeft &&
          coords.y < nodeTop + nodeSize && coords.y + nodeSize > nodeTop) {
        isOverlap = true;
      }
    });

    if (!isOverlap) {
      draggedNode.style.left = coords.x + 'px';
      draggedNode.style.top = coords.y + 'px';
    }

    draggedNode.style.zIndex = '';
    draggedNode.style.opacity = '';
    ghostNode.style.display = 'none';

    updateNodeRoads(draggedNode);
    
    draggedNode = null;
    saveMap();
  }
});

workspace.addEventListener('click', function(event) {
  const rect = workspace.getBoundingClientRect();
  const rawX = event.clientX - rect.left;
  const rawY = event.clientY - rect.top;
  const clickedNode = event.target.closest('.map-node');

  if (!event.target.classList.contains('map-road') && !event.target.closest('.map-node')) {
    resetSelection();
    switchTab('assets');
  }

  if (isDeleteToolActive) {
    if (event.target.classList.contains('map-road')) {
      event.target.remove();
      saveMap();
      return;
    }

    if (clickedNode) {
      const nodeId = clickedNode.id;
      const connectedRoads = document.querySelectorAll(`.map-road[data-from="${nodeId}"], .map-road[data-to="${nodeId}"]`);
      connectedRoads.forEach(road => road.remove());
      clickedNode.remove();
      saveMap();
    }
    return; 
  }

  if (isRoadToolActive) {
    if (clickedNode) {
      if (!roadStartNode) {
        roadStartNode = clickedNode;
        roadStartNode.style.borderColor = '#00acc1'; 
      } else {
        if (clickedNode !== roadStartNode) {
          drawRoad(roadStartNode, clickedNode, false);
          saveMap();
        }
        roadStartNode.style.borderColor = '#000000';
        roadStartNode = null;
      }
    }
    return;
  }

  if (!isLocToolActive) return;
  if (event.target !== workspace) return;

  const coords = getSnappedCoords(rawX, rawY);

  const existingNodes = document.querySelectorAll('.map-node');
  let isOverlap = false;
  existingNodes.forEach(function(node) {
    const nodeLeft = parseInt(node.style.left);
    const nodeTop = parseInt(node.style.top);
    if (coords.x < nodeLeft + nodeSize && coords.x + nodeSize > nodeLeft &&
        coords.y < nodeTop + nodeSize && coords.y + nodeSize > nodeTop) {
      isOverlap = true;
    }
  });

  if (isOverlap) return; 

  const newId = 'node-' + Date.now();
  createNodeOnWorkspace(newId, coords.x + 'px', coords.y + 'px');
  saveMap(); 
});


/* 7. Инструменты боковой панели и настройки */


function resetAllTools() {
  isLocToolActive = false;
  isRoadToolActive = false;
  isDeleteToolActive = false;
  
  toolLoc.classList.remove('active');
  toolRoad.classList.remove('active');
  toolDelete.classList.remove('active');
  
  workspace.classList.remove('delete-mode'); 
  ghostNode.style.display = 'none';
  if (roadStartNode) {
    roadStartNode.style.borderColor = '#000000';
    roadStartNode = null;
  }

  resetSelection();
}

toolLoc.addEventListener('click', function() {
  const targetState = !isLocToolActive;
  resetAllTools();
  isLocToolActive = targetState;
  toolLoc.classList.toggle('active', isLocToolActive);
});

toolRoad.addEventListener('click', function() {
  const targetState = !isRoadToolActive;
  resetAllTools();
  isRoadToolActive = targetState;
  toolRoad.classList.toggle('active', isRoadToolActive);
});

toolDelete.addEventListener('click', function() {
  const targetState = !isDeleteToolActive;
  resetAllTools();
  isDeleteToolActive = targetState;
  toolDelete.classList.toggle('active', isDeleteToolActive);
  if (isDeleteToolActive) workspace.classList.add('delete-mode');
});

workspace.addEventListener('mouseleave', function() {
  if (!draggedNode) ghostNode.style.display = 'none';
});

// События изменения дорог
roadTypeSelect.addEventListener('change', function() {
  if (!selectedRoad) return;
  selectedRoad.setAttribute('data-type', roadTypeSelect.value);
  applyRoadStyles(selectedRoad);
  saveMap();
});

roadColorSelect.addEventListener('change', function() {
  if (!selectedRoad) return;
  selectedRoad.setAttribute('data-color', roadColorSelect.value);
  applyRoadStyles(selectedRoad); 
  saveMap();
});

// События изменения локаций
nodeColorSelect.addEventListener('change', function() {
  if (!selectedNode) return;
  const newColor = nodeColorSelect.value;
  selectedNode.setAttribute('data-color', newColor);
  selectedNode.style.backgroundColor = newColor;
  saveMap();
});

nodeIconSelect.addEventListener('change', function() {
  if (!selectedNode) return;
  const newIcon = nodeIconSelect.value;
  selectedNode.setAttribute('data-icon', newIcon);
  
  const iconDisplay = selectedNode.querySelector('.node-icon-display');
  if (iconDisplay) iconDisplay.textContent = newIcon;
  saveMap();
});


/* 8. Локальное хранилище */


function saveMap() {
  const nodesData = [];
  const roadsData = [];

  document.querySelectorAll('.map-node').forEach(node => {
    nodesData.push({
      id: node.id,
      left: node.style.left,
      top: node.style.top,
      text: node.querySelector('.node-text').textContent,
      color: node.getAttribute('data-color') || '#ffffff',
      icon: node.getAttribute('data-icon') || ''
    });
  });

  document.querySelectorAll('.map-road').forEach(road => {
    roadsData.push({
      from: road.getAttribute('data-from'),
      to: road.getAttribute('data-to'),
      points: road.getAttribute('points'),
      type: road.getAttribute('data-type') || 'normal',
      color: road.getAttribute('data-color') || '#000000'
    });
  });

  const mapData = { nodes: nodesData, roads: roadsData };
  localStorage.setItem('rpg_map_data', JSON.stringify(mapData));
}

function loadMap() {
  const rawData = localStorage.getItem('rpg_map_data');
  if (!rawData) return;

  const mapData = JSON.parse(rawData);

  mapData.nodes.forEach(data => {
    createNodeOnWorkspace(data.id, data.left, data.top, data.text, data.color, data.icon);
  });

  const linesToAnimate = [];

  mapData.roads.forEach(data => {
    const nodeA = document.getElementById(data.from);
    const nodeB = document.getElementById(data.to);
    if (nodeA && nodeB) {
      const road = drawRoad(nodeA, nodeB, true); 
      if (road) {
        road.setAttribute('data-type', data.type);
        road.setAttribute('data-color', data.color);
        applyRoadStyles(road);
        linesToAnimate.push(road);
      }
    }
  });

  if (linesToAnimate.length > 0) {
    setTimeout(() => {
      linesToAnimate.forEach(road => {
        triggerRoadAnimation(road);
      });
    }, 200); 
  }
}

loadMap();


/* 9. Экспорт и импорт */


const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const importFileInput = document.getElementById('import-file');

btnExport.addEventListener('click', function() {
  const rawData = localStorage.getItem('rpg_map_data');
  if (!rawData) {
    alert('Карта пуста, нечего экспортировать!');
    return;
  }
  
  const blob = new Blob([rawData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `rpg_map_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

btnImport.addEventListener('click', function() {
  importFileInput.click();
});

importFileInput.addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsedData = JSON.parse(e.target.result);
      
      if (!parsedData.nodes || !parsedData.roads) {
        throw new Error('Неверный формат файла карты');
      }

      localStorage.setItem('rpg_map_data', JSON.stringify(parsedData));
      
      document.querySelectorAll('.map-node').forEach(node => node.remove());
      document.querySelectorAll('.map-road').forEach(road => road.remove());
      resetSelection();

      loadMap();
      alert('Карта успешно импортирована!');
    } catch (err) {
      alert('Ошибка при чтении файла: ' + err.message);
    }
  };
  reader.readAsText(file);

  importFileInput.value = ''; 
});