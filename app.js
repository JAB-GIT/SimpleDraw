var isOracleActive = false;
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const coordBar = document.getElementById('coordinates-bar');

// State
let polylines = [];
let labels = [];
let layers = {
    '0': { color: '#000000', visible: true },
    'basura': { color: '#888888', visible: false }
};
let currentLayer = '0';
let currentTool = 'select';
let selectedObjects = [];
let clipboard = [];
let typedLength = '';

// Document & Pages
let documentSettings = {
    units: 'cm', projNum: '', projectName: '', fileName: 'Nuevo_Dibujo', draftsman: '', address: '', comments: '', lblPrecision: 2
};
let pages = [];

// Workspace Settings
let workspaceSettings = {
    bgColor: '#fdfbf7',
    grid: { enabled: true, type: 'absolute', color: '#ffd6d6', sizeX: 100, sizeY: 100, angle: 0 }
};

// Time Map Engine
let timeMap = {
    nodes: {},
    activeNodeId: null,
    counter: 0
};
let isTimeMapEnabled = true;

function commitTimeMap(message, tag = null) {
    if (!isTimeMapEnabled) return;
    
    const state = {
        polylines: structuredClone(polylines),
        labels: structuredClone(labels),
        pages: structuredClone(pages),
        layers: structuredClone(layers),
        workspaceSettings: structuredClone(workspaceSettings),
        documentSettings: structuredClone(documentSettings),
        currentLayer: currentLayer
    };
    
    timeMap.counter++;
    const nodeId = "commit_" + timeMap.counter;
    const parentId = timeMap.activeNodeId;
    
let hue = 200;
    if (parentId && timeMap.nodes[parentId]) {
        const parent = timeMap.nodes[parentId];
        const childIndex = parent.childrenIds.length;
        if (childIndex === 0) {
            hue = parent.hue !== undefined ? parent.hue : 200;
        } else {
            hue = ((parent.hue !== undefined ? parent.hue : 200) + (45 * childIndex)) % 360;
        }
    }
    
    const node = {
        id: nodeId,
        parentId: parentId,
        childrenIds: [],
        state: state,
        message: message,
        tag: tag,
        hue: hue,
        timestamp: Date.now()
    };
    
    timeMap.nodes[nodeId] = node;
    if (parentId && timeMap.nodes[parentId]) {
        timeMap.nodes[parentId].childrenIds.push(nodeId);
    }
    timeMap.activeNodeId = nodeId;
    console.log("TimeMap Commit:", message, tag || "");
    if (window.renderTimeMapSVG) window.renderTimeMapSVG();
}

function checkoutNode(nodeId) {
    if (!timeMap.nodes[nodeId]) return;
    const node = timeMap.nodes[nodeId];
    
    const s = node.state;
    polylines = structuredClone(s.polylines);
    labels = structuredClone(s.labels);
    pages = structuredClone(s.pages);
    layers = structuredClone(s.layers);
    workspaceSettings = structuredClone(s.workspaceSettings);
    documentSettings = structuredClone(s.documentSettings);
    
    if (s.currentLayer && layers[s.currentLayer]) {
        currentLayer = s.currentLayer;
    } else {
        if (!layers[currentLayer]) {
            const available = Object.keys(layers);
            currentLayer = available.length > 0 ? available[0] : '0';
            if (!layers['0'] && available.length === 0) {
                layers['0'] = { color: '#ffffff', visible: true };
                currentLayer = '0';
            }
        }
    }
    
    timeMap.activeNodeId = nodeId;
    
    selectedObjects = [];
    currentPolyline = null;
    moveState = 'NONE';
    rotateState = 'NONE';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const selBtn = document.querySelector('.tool-btn[data-tool="select"]');
    if (selBtn) selBtn.classList.add('active');
    currentTool = 'select';
    
    updateLayersUI();
    if (typeof updateSettingsUI === 'function') updateSettingsUI();
    updatePropertiesPanel();
    draw();
    
    console.log("TimeMap Checkout:", node.message);
    if (window.renderTimeMapSVG) window.renderTimeMapSVG();
}

function tagCurrentNode(tag) {
    if (timeMap.activeNodeId && timeMap.nodes[timeMap.activeNodeId]) {
        timeMap.nodes[timeMap.activeNodeId].tag = tag;
        console.log("TimeMap Tagged:", tag);
    }
}

function resetTimeMap(initialMessage = "Dibujo inicial") {
    timeMap = { nodes: {}, activeNodeId: null, counter: 0 };
    commitTimeMap(initialMessage);
}

// Camera/View state
let panX = 0;
let panY = 0;
let scale = 1;

// Drawing state
let currentPolyline = null;
let polylineMode = 'line';
let currentPreviewBulge = 0;
let mouseX = 0;
let mouseY = 0;
let worldX = 0;
let worldY = 0;
let rawWorldX = 0;
let rawWorldY = 0;
let snapPoint = null;
let lastUsedPoint = null;

// Move/Copy state
let moveSelection = [];
let moveState = 'NONE'; // SELECTING, ORIGIN, DESTINATION, ADJUSTING
let moveOrigin = null;
let moveDest = null;
let moveCommandInput = '';
let moveModifier = ''; // for modifiers like 'C'

let rotateState = 'NONE'; // SELECTING, ORIGIN, REFERENCE, ANGLE
let rotateOrigin = null;
let rotateReference = null;
let rotateTargetPoint = null;
let rotateSelection = [];
let rotateCommandInput = '';
let rotateModifier = '';

let isCopyMode = false;

// UI Elements - Topbar
const btnNew = document.getElementById('btn-new');
const btnOpen = document.getElementById('btn-open');
const fileOpenInput = document.getElementById('file-open-input');
const btnSave = document.getElementById('btn-save');
const btnDocSettings = document.getElementById('btn-doc-settings');
const btnAddPage = document.getElementById('btn-add-page');
const btnPrint = document.getElementById('btn-print');
const btnZoomExt = document.getElementById('btn-zoom-ext');

const orthoToggle = document.getElementById('toggle-ortho');
const orthoAngleInput = document.getElementById('ortho-angle');
const snapToggle = document.getElementById('toggle-snap');

// UI Elements - Sidebar
const layersList = document.getElementById('layers-list');
const newLayerInput = document.getElementById('new-layer-input');
const btnAddLayer = document.getElementById('btn-add-layer');
const propertiesPanel = document.getElementById('properties-panel');
const propType = document.getElementById('prop-type');
const propLayer = document.getElementById('prop-layer');
const propLength = document.getElementById('prop-length');
const propLayerContainer = document.getElementById('prop-layer-container');
const propLengthContainer = document.getElementById('prop-length-container');
const propLblSizeContainer = document.getElementById('prop-lbl-size-container');
const propLblSize = document.getElementById('prop-lbl-size');
const propLblPrecContainer = document.getElementById('prop-lbl-prec-container');
const propLblPrec = document.getElementById('prop-lbl-prec');
const propPageContainer = document.getElementById('prop-page-container');
const btnEditPage = document.getElementById('btn-edit-page');
const btnDelete = document.getElementById('btn-delete');

const lengthInputOverlay = document.getElementById('length-input-overlay');
const lengthInput = document.getElementById('length-input');

// Settings Modals
const docModal = document.getElementById('doc-modal');
const pageModal = document.getElementById('page-modal');
const printModal = document.getElementById('print-modal');

// Settings Panel UI Elements
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const setBgColor = document.getElementById('set-bg-color');
const setGridEnable = document.getElementById('set-grid-enable');
const gridSettingsDiv = document.getElementById('grid-settings');
const setGridType = document.getElementById('set-grid-type');
const setGridColor = document.getElementById('set-grid-color');
const setGridX = document.getElementById('set-grid-x');
const setGridY = document.getElementById('set-grid-y');
const setGridAngle = document.getElementById('set-grid-angle');

// Initialize UI
updateLayersUI();
updateSettingsUI();

// Document Settings Modal
btnDocSettings.addEventListener('click', () => {
    document.getElementById('doc-units').value = documentSettings.units;
    document.getElementById('doc-precision').value = documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2;
    document.getElementById('doc-proj-num').value = documentSettings.projNum;
    document.getElementById('doc-project').value = documentSettings.projectName;
    document.getElementById('doc-name').value = documentSettings.fileName;
    document.getElementById('doc-draftsman').value = documentSettings.draftsman;
    document.getElementById('doc-address').value = documentSettings.address;
    document.getElementById('doc-comments').value = documentSettings.comments;
    docModal.style.display = 'flex';
});
document.getElementById('doc-modal-cancel').addEventListener('click', () => docModal.style.display = 'none');
document.getElementById('doc-modal-confirm').addEventListener('click', () => {
    documentSettings.units = document.getElementById('doc-units').value;
    documentSettings.lblPrecision = parseInt(document.getElementById('doc-precision').value);
    if (isNaN(documentSettings.lblPrecision)) documentSettings.lblPrecision = 2;
    documentSettings.projNum = document.getElementById('doc-proj-num').value;
    documentSettings.projectName = document.getElementById('doc-project').value;
    documentSettings.fileName = document.getElementById('doc-name').value;
    documentSettings.draftsman = document.getElementById('doc-draftsman').value;
    documentSettings.address = document.getElementById('doc-address').value;
    documentSettings.comments = document.getElementById('doc-comments').value;
    docModal.style.display = 'none';
    draw();
});

// Page Settings Modal
let editingPageIdx = -1;
function openPageModal(idx) {
    editingPageIdx = idx;
    const p = pages[idx];
    document.getElementById('page-name').value = p.name;
    document.getElementById('page-format').value = p.format;
    document.getElementById('page-orient').value = p.orient;
    
    const pageScale = document.getElementById('page-scale');
    let isStandard = false;
    for (const opt of pageScale.options) {
        if (opt.value == p.scaleType) {
            pageScale.value = p.scaleType;
            isStandard = true;
            break;
        }
    }
    if (!isStandard) {
        pageScale.value = 'custom';
    }
    
    document.getElementById('page-scale-custom').value = p.scaleCustom || p.scale;
    document.getElementById('page-bgcolor').value = p.bgColor;
    document.getElementById('page-show-bg').checked = p.showBg;
    document.getElementById('page-border-color').value = p.borderColor || '#000000';
    document.getElementById('page-show-border').checked = p.showBorder;
    document.getElementById('page-anchor').value = p.anchor;
    
    document.getElementById('page-margin-t-val').value = p.margins.t.val;
    document.getElementById('page-margin-t-show').checked = p.margins.t.show;
    document.getElementById('page-margin-b-val').value = p.margins.b.val;
    document.getElementById('page-margin-b-show').checked = p.margins.b.show;
    document.getElementById('page-margin-l-val').value = p.margins.l.val;
    document.getElementById('page-margin-l-show').checked = p.margins.l.show;
    document.getElementById('page-margin-r-val').value = p.margins.r.val;
    document.getElementById('page-margin-r-show').checked = p.margins.r.show;
    
    document.getElementById('page-foot-l').value = p.footL;
    document.getElementById('page-foot-c').value = p.footC;
    document.getElementById('page-foot-r').value = p.footR;
    
    pageModal.style.display = 'flex';
}
document.getElementById('page-modal-cancel').addEventListener('click', () => pageModal.style.display = 'none');
document.getElementById('page-modal-confirm').addEventListener('click', () => {
    if (editingPageIdx >= 0) {
        const p = pages[editingPageIdx];
        p.name = document.getElementById('page-name').value;
        p.format = document.getElementById('page-format').value;
        p.orient = document.getElementById('page-orient').value;
        
        const pageScale = document.getElementById('page-scale').value;
        p.scaleType = pageScale;
        p.scaleCustom = parseFloat(document.getElementById('page-scale-custom').value) || 100;
        p.scale = (p.scaleType === 'custom') ? p.scaleCustom : parseFloat(p.scaleType);
        
        p.bgColor = document.getElementById('page-bgcolor').value;
        p.showBg = document.getElementById('page-show-bg').checked;
        p.borderColor = document.getElementById('page-border-color').value;
        p.showBorder = document.getElementById('page-show-border').checked;
        p.anchor = document.getElementById('page-anchor').value;
        
        p.margins.t = { val: parseFloat(document.getElementById('page-margin-t-val').value) || 0, show: document.getElementById('page-margin-t-show').checked };
        p.margins.b = { val: parseFloat(document.getElementById('page-margin-b-val').value) || 0, show: document.getElementById('page-margin-b-show').checked };
        p.margins.l = { val: parseFloat(document.getElementById('page-margin-l-val').value) || 0, show: document.getElementById('page-margin-l-show').checked };
        p.margins.r = { val: parseFloat(document.getElementById('page-margin-r-val').value) || 0, show: document.getElementById('page-margin-r-show').checked };
        
        p.footL = document.getElementById('page-foot-l').value;
        p.footC = document.getElementById('page-foot-c').value;
        p.footR = document.getElementById('page-foot-r').value;
        
        pageModal.style.display = 'none';
        draw();
    }
});

// Print Modal
btnPrint.addEventListener('click', () => {
    const selPageObj = selectedObjects.find(o => o.type === 'page');
    const selectedPageIdx = selPageObj ? selPageObj.index : -1;

    document.getElementById('print-selection').innerHTML = '';
    const sel = document.getElementById('print-selection');
    sel.innerHTML += `<option value="all">Todas (${pages.length})</option>`;
    if (selectedPageIdx >= 0 && pages[selectedPageIdx]) {
        sel.innerHTML += `<option value="selected">Seleccionada: ${pages[selectedPageIdx].name}</option>`;
    }
    pages.forEach((p, i) => {
        sel.innerHTML += `<option value="${i}">${p.name}</option>`;
    });
    printModal.style.display = 'flex';
});
document.getElementById('print-modal-cancel').addEventListener('click', () => printModal.style.display = 'none');
document.getElementById('print-modal-confirm').addEventListener('click', async () => {
    printModal.style.display = 'none';
    await generatePDF();
});

// Zoom Extension
btnZoomExt.addEventListener('click', () => {
    let { minX, minY, maxX, maxY } = computeBounds(polylines);
    pages.forEach(p => {
        const dim = getPageWorldDimensions(p);
        const tl = getPageTopLeft(p);
        if (tl.x < minX) minX = tl.x;
        if (tl.y - dim.h < minY) minY = tl.y - dim.h;
        if (tl.x + dim.w > maxX) maxX = tl.x + dim.w;
        if (tl.y > maxY) maxY = tl.y;
    });
    
    if (minX === Infinity) {
        panX = canvas.width / 2; panY = canvas.height / 2; scale = 1;
    } else {
        const padding = 50; 
        const w = maxX - minX;
        const h = maxY - minY;
        const scaleX = (canvas.width - padding * 2) / (w || 1);
        const scaleY = (canvas.height - padding * 2) / (h || 1);
        scale = Math.min(scaleX, scaleY);
        
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        panX = (canvas.width / 2) - (cx * scale);
        panY = (canvas.height / 2) - (-cy * scale);
    }
    draw();
});

// Page Math
function getPageWorldDimensions(page) {
    const formats = {
        'A4': { w: 210, h: 297 },
        'A3': { w: 297, h: 420 },
        'A2': { w: 420, h: 594 },
        'A1': { w: 594, h: 841 },
        'A0': { w: 841, h: 1189 }
    };
    let w_mm = formats[page.format].w;
    let h_mm = formats[page.format].h;
    if (page.orient === 'landscape') {
        const temp = w_mm; w_mm = h_mm; h_mm = temp;
    }
    let multiplier = 1; 
    if (documentSettings.units === 'cm') multiplier = 0.1;
    if (documentSettings.units === 'm') multiplier = 0.001;
    return {
        w: (w_mm * multiplier) * page.scale,
        h: (h_mm * multiplier) * page.scale
    };
}

function getPageTopLeft(page) {
    const dim = getPageWorldDimensions(page);
    let tx = page.x, ty = page.y;
    if (page.anchor[1] === 'c') tx -= dim.w/2;
    if (page.anchor[1] === 'r') tx -= dim.w;
    if (page.anchor[0] === 'm') ty += dim.h/2; 
    if (page.anchor[0] === 'b') ty += dim.h; 
    return { x: tx, y: ty };
}

btnAddPage.addEventListener('click', () => {
    let { minX, minY, maxX, maxY } = computeBounds(polylines);
    
    let targetW = (maxX === -Infinity) ? 100 : (maxX - minX);
    let targetH = (maxY === -Infinity) ? 100 : (maxY - minY);
    if (targetW === 0) targetW = 100;
    if (targetH === 0) targetH = 100;
    
    // Calculate required scale for A4 Landscape
    let multiplier = (documentSettings.units === 'cm') ? 0.1 : ((documentSettings.units === 'm') ? 0.001 : 1);
    const paperW = 297 * multiplier;
    const paperH = 210 * multiplier;
    
    const requiredScaleX = targetW / paperW;
    const requiredScaleY = targetH / paperH;
    const reqScale = Math.max(requiredScaleX, requiredScaleY);
    
    const standards = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let bestScale = standards[standards.length - 1];
    for (let s of standards) {
        if (s >= reqScale) {
            bestScale = s;
            break;
        }
    }
    
    const cx = (minX === Infinity) ? 0 : (minX + maxX)/2;
    const cy = (minY === Infinity) ? 0 : (minY + maxY)/2;
    
    pages.push({
        name: `Página ${pages.length + 1}`,
        format: 'A4',
        orient: 'landscape',
        scaleType: bestScale.toString(),
        scaleCustom: bestScale,
        scale: bestScale,
        x: cx,
        y: cy,
        anchor: 'mc', // Center
        bgColor: '#ffffff',
        showBg: true,
        borderColor: '#000000',
        showBorder: true,
        marginColor: '#0000ff',
        margins: {
            t: { val: 5, show: true },
            b: { val: 10, show: true },
            l: { val: 5, show: true },
            r: { val: 5, show: true }
        },
        footL: '#doc-numero# - #doc-proyecto#',
        footC: 'Escala 1:#pag-escala#',
        footR: 'Pág. #pag-numero#'
    });
    draw();
    commitTimeMap('Página creada');
});

// Settings Logic
btnSettings.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
});

function updateSettingsUI() {
    setBgColor.value = workspaceSettings.bgColor;
    setGridEnable.checked = workspaceSettings.grid.enabled;
    gridSettingsDiv.style.display = workspaceSettings.grid.enabled ? 'block' : 'none';
    setGridType.value = workspaceSettings.grid.type;
    setGridColor.value = workspaceSettings.grid.color;
    setGridX.value = workspaceSettings.grid.sizeX;
    setGridY.value = workspaceSettings.grid.sizeY;
    setGridAngle.value = workspaceSettings.grid.angle;
}

setBgColor.addEventListener('input', (e) => { workspaceSettings.bgColor = e.target.value; draw(); });
setGridEnable.addEventListener('change', (e) => { 
    workspaceSettings.grid.enabled = e.target.checked; 
    gridSettingsDiv.style.display = workspaceSettings.grid.enabled ? 'block' : 'none';
    draw(); 
});
setGridType.addEventListener('change', (e) => { workspaceSettings.grid.type = e.target.value; draw(); });
setGridColor.addEventListener('input', (e) => { workspaceSettings.grid.color = e.target.value; draw(); });
setGridX.addEventListener('input', (e) => { workspaceSettings.grid.sizeX = parseFloat(e.target.value) || 100; draw(); });
setGridY.addEventListener('input', (e) => { workspaceSettings.grid.sizeY = parseFloat(e.target.value) || 100; draw(); });
setGridAngle.addEventListener('input', (e) => { workspaceSettings.grid.angle = parseFloat(e.target.value) || 0; draw(); });

// File Tools
btnNew.addEventListener('click', () => {
    if (confirm('¿Estás seguro de crear un nuevo documento? Perderás los cambios no guardados.')) {
        polylines = [];
        labels = [];
        pages = [];
        layers = {
            '0': { color: '#ffffff', visible: true },
            'basura': { color: '#888888', visible: false }
        };
        workspaceSettings = {
            bgColor: '#121214',
            grid: { enabled: false, type: 'absolute', color: '#333333', sizeX: 100, sizeY: 100, angle: 0 }
        };
        documentSettings = { units: 'cm', projNum: '', projectName: '', fileName: 'Nuevo_Dibujo', draftsman: '', address: '', comments: '' };
        currentLayer = '0';
        selectedObjects = [];
        currentPolyline = null;
        panX = 0;
        panY = 0;
        scale = 1;
        updateLayersUI();
        updateSettingsUI();
        updatePropertiesPanel();
        draw();
        resetTimeMap('Nuevo Dibujo');
    }
});

btnSave.addEventListener('click', () => {
    const data = { polylines, labels, layers, workspaceSettings, documentSettings, pages, timeMap };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (documentSettings.fileName || 'dibujo') + '.json';
    a.click();
    URL.revokeObjectURL(url);
});

btnOpen.addEventListener('click', () => { fileOpenInput.click(); });

fileOpenInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.polylines && data.layers) {
                polylines = data.polylines;
                labels = data.labels || [];
                layers = data.layers;
                if (data.workspaceSettings) workspaceSettings = data.workspaceSettings;
                if (data.documentSettings) documentSettings = data.documentSettings;
                documentSettings.fileName = file.name.replace('.json', '');
                
                // Retro-compatibility: if projectName is missing but name exists
                if (documentSettings.name && !documentSettings.projectName) {
                    documentSettings.projectName = documentSettings.name;
                }
                if (data.pages) pages = data.pages;
                
                if (!layers['0']) layers['0'] = { color: '#ffffff', visible: true };
                if (!layers['basura']) layers['basura'] = { color: '#888888', visible: false };
                
                selectedObjects = [];
                currentPolyline = null;
                updateLayersUI();
                updateSettingsUI();
                updatePropertiesPanel();
                fitToScreen();
                if (data.timeMap) {
                    timeMap = data.timeMap;
                    assignHuesToGraph();
                    console.log("TimeMap cargado desde archivo con " + Object.keys(timeMap.nodes).length + " nodos.");
                } else {
                    resetTimeMap('Archivo cargado');
                }
            } else {
                alert('El archivo no tiene un formato válido.');
            }
        } catch (err) {
            alert('Error al leer el archivo JSON.');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
});

// Resize canvas
function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function screenToWorld(sx, sy) { return { x: (sx - panX) / scale, y: -(sy - panY) / scale }; }
function worldToScreen(wx, wy) { return { x: (wx * scale) + panX, y: (-wy * scale) + panY }; }
function rotatePoint(x, y, rad, cx = 0, cy = 0) { 
    const dx = x - cx;
    const dy = y - cy;
    return { 
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), 
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) 
    }; 
}

function generateColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function updateLayersUI() {
    layersList.innerHTML = '';
    propLayer.innerHTML = '';
    for (const [layerName, layerData] of Object.entries(layers)) {
        const div = document.createElement('div');
        div.className = `layer-item ${currentLayer === layerName ? 'active' : ''}`;
        div.dataset.layer = layerName;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        
        const visIcon = layerData.visible ? '👁️' : '🕶️';
        let deleteBtnHTML = '';
        if (layerName !== '0' && layerName !== 'basura') {
            deleteBtnHTML = `<span class="layer-delete" style="cursor:pointer; margin-left:auto; color:#ff4444; font-size:12px;" title="Borrar capa">🗑️</span>`;
        }
        
        div.innerHTML = `
            <span class="layer-vis" style="cursor:pointer; margin-right:5px; font-size:12px;" title="Alternar visibilidad">${visIcon}</span>
            <input type="color" class="layer-color-picker" value="${layerData.color}" style="width:20px; height:20px; padding:0; border:none; margin-right:5px; cursor:pointer;" title="Cambiar color">
            <span class="layer-name" style="flex:1;">${layerName}</span>
            ${deleteBtnHTML}
        `;
        
        const nameSpan = div.querySelector('.layer-name');
        if (layerName !== '0' && layerName !== 'basura') {
            nameSpan.style.cursor = 'text';
            nameSpan.title = "Doble clic para renombrar";
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newName = prompt("Nuevo nombre para la capa:", layerName);
                if (newName && newName.trim() !== '' && newName.trim() !== layerName) {
                    const finalName = newName.trim();
                    if (layers[finalName]) {
                        alert("Ya existe una capa con ese nombre.");
                        return;
                    }
                    layers[finalName] = layers[layerName];
                    delete layers[layerName];
                    polylines.forEach(pl => { if (pl.layer === layerName) pl.layer = finalName; });
                    labels.forEach(lbl => { if (lbl.layer === layerName) lbl.layer = finalName; });
                    if (currentLayer === layerName) currentLayer = finalName;
                    updateLayersUI();
                    updatePropertiesPanel();
                    draw();
                    commitTimeMap('Capa renombrada');
                }
            });
        }
        
        div.querySelector('.layer-vis').addEventListener('click', (e) => {
            e.stopPropagation(); layers[layerName].visible = !layers[layerName].visible; updateLayersUI(); draw();
        });
        
        div.querySelector('.layer-color-picker').addEventListener('input', (e) => {
            e.stopPropagation(); layers[layerName].color = e.target.value; draw();
        });
        div.querySelector('.layer-color-picker').addEventListener('click', (e) => e.stopPropagation());

        const delBtn = div.querySelector('.layer-delete');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteLayer(layerName); });
        }

        div.addEventListener('click', () => { currentLayer = layerName; updateLayersUI(); });
        layersList.appendChild(div);
        
        const opt = document.createElement('option');
        opt.value = layerName;
        opt.textContent = layerName;
        propLayer.appendChild(opt);
    }
    
    if (selectedObjects && selectedObjects.length > 0) {
        // Just call updatePropertiesPanel to re-evaluate what to show
        updatePropertiesPanel();
    }
}

let pendingDeleteLayer = null;
function deleteLayer(layerName) {
    let objectsInLayer = 0;
    polylines.forEach(pl => { if (pl.layer === layerName) objectsInLayer++; });
    labels.forEach(lbl => { if (lbl.layer === layerName) objectsInLayer++; });
    
    if (objectsInLayer > 0) {
        showLayerModal(layerName, objectsInLayer);
    } else {
        executeDeleteLayer(layerName, '0');
    }
}
function showLayerModal(layerName, count) {
    pendingDeleteLayer = layerName;
    document.getElementById('layer-modal-msg').textContent = `La capa '${layerName}' tiene ${count} objetos. ¿A qué capa deseas moverlos?`;
    const select = document.getElementById('layer-modal-select');
    select.innerHTML = '';
    for (const name in layers) {
        if (name !== layerName && name !== 'basura') {
            const opt = document.createElement('option'); opt.value = name; opt.textContent = name; select.appendChild(opt);
        }
    }
    const input = document.getElementById('layer-modal-input');
    input.value = '0'; input.style.color = '#00ff00'; select.value = '0';
    document.getElementById('layer-modal').style.display = 'flex';
    input.focus();
}
function executeDeleteLayer(layerName, targetLayer) {
    polylines.forEach(pl => { if (pl.layer === layerName) pl.layer = targetLayer; });
    labels.forEach(lbl => { if (lbl.layer === layerName) lbl.layer = targetLayer; });
    delete layers[layerName];
    if (currentLayer === layerName) currentLayer = '0';
    updateLayersUI(); updatePropertiesPanel(); draw();
}
document.getElementById('layer-modal-cancel').addEventListener('click', () => { document.getElementById('layer-modal').style.display = 'none'; pendingDeleteLayer = null; });
document.getElementById('layer-modal-confirm').addEventListener('click', () => {
    const targetLayer = document.getElementById('layer-modal-input').value.trim() || '0';
    if (!layers[targetLayer] || targetLayer === pendingDeleteLayer || targetLayer === 'basura') { alert("La capa destino no existe o no es válida."); return; }
    document.getElementById('layer-modal').style.display = 'none';
    executeDeleteLayer(pendingDeleteLayer, targetLayer);
});
document.getElementById('layer-modal-input').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (layers[val] && val !== pendingDeleteLayer && val !== 'basura') {
        e.target.style.color = '#00ff00'; document.getElementById('layer-modal-select').value = val;
    } else { e.target.style.color = '#ff4444'; }
});
document.getElementById('layer-modal-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('layer-modal-confirm').click(); });
document.getElementById('layer-modal-select').addEventListener('change', (e) => {
    document.getElementById('layer-modal-input').value = e.target.value; document.getElementById('layer-modal-input').style.color = '#00ff00';
});

btnAddLayer.addEventListener('click', () => {
    const name = newLayerInput.value.trim();
    if (!name) return;
    if (layers[name]) { alert("Ya existe una capa con ese nombre."); return; }
    layers[name] = { color: generateColor(name), visible: true };
    newLayerInput.value = '';
    currentLayer = name;
    updateLayersUI();
    commitTimeMap('Capa creada');
});

function fitToScreen() {
    if (polylines.length === 0) return;
    let { minX, minY, maxX, maxY } = computeBounds(polylines);
    const width = maxX - minX; const height = maxY - minY;
    if (width === 0 && height === 0) return;
    const scaleX = canvas.width / (width * 1.2); const scaleY = canvas.height / (height * 1.2);
    scale = Math.min(scaleX, scaleY);
    panX = (canvas.width / 2) - ((minX + width/2) * scale);
    panY = (canvas.height / 2) - (-(minY + height/2) * scale);
    draw();
}

// Tools
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.tool;
        
        selectedObjects = [];
        updatePropertiesPanel();
        
        currentPolyline = null;
        polylineMode = 'line';
        currentPreviewBulge = 0;
        typedLength = '';
        lengthInputOverlay.style.display = 'none';
        
        moveState = (currentTool === 'move') ? 'SELECTING' : 'NONE';
        moveSelection = [];
        moveOrigin = null; moveDest = null; moveModifier = ''; moveCommandInput = ''; 
        
        rotateState = (currentTool === 'rotate') ? 'SELECTING' : 'NONE';
        rotateSelection = [];
        rotateOrigin = null; rotateReference = null; rotateModifier = ''; rotateCommandInput = '';
        
        isCopyMode = false;
        
        if (currentTool === 'select' || currentTool === 'label') canvas.style.cursor = 'default';
        else if (currentTool === 'polyline') canvas.style.cursor = 'none';
        else if (currentTool === 'move' || currentTool === 'rotate') canvas.style.cursor = 'crosshair';
        draw();
    });
});
canvas.style.cursor = 'default';

// Arc Math Helpers
function computeBounds(polys) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(pl => {
        for (let i = 0; i < pl.points.length; i++) {
            const p1 = pl.points[i];
            if (p1.x < minX) minX = p1.x; if (p1.y < minY) minY = p1.y;
            if (p1.x > maxX) maxX = p1.x; if (p1.y > maxY) maxY = p1.y;

            if (p1.bulge && p1.bulge !== 0) {
                let nextIdx = i + 1;
                if (nextIdx === pl.points.length) {
                    if (pl.closed) nextIdx = 0;
                    else continue;
                }
                const p2 = pl.points[nextIdx];
                const arc = getArcParams(p1, p2, p1.bulge);
                if (arc) {
                    const samples = 12;
                    let angStart = arc.startAngle;
                    let angEnd = arc.endAngle;
                    if (arc.ccw && angEnd < angStart) angEnd += 2 * Math.PI;
                    if (!arc.ccw && angEnd > angStart) angEnd -= 2 * Math.PI;
                    const step = (angEnd - angStart) / samples;
                    for (let j = 1; j < samples; j++) {
                        const a = angStart + step * j;
                        const px = arc.cx + arc.R * Math.cos(a);
                        const py = arc.cy + arc.R * Math.sin(a);
                        if (px < minX) minX = px; if (py < minY) minY = py;
                        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
                    }
                }
            }
        }
    });
    return { minX, minY, maxX, maxY };
}

function getArcParams(p1, p2, bulge) {
    if (!bulge || bulge === 0) return null;
    const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (L === 0) return null;
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const a = (L / 2) * ((1 - bulge * bulge) / (2 * bulge));
    const cx = mx - a * (p2.y - p1.y) / L;
    const cy = my + a * (p2.x - p1.x) / L;
    const R = Math.hypot(p1.x - cx, p1.y - cy);
    const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
    const endAngle = Math.atan2(p2.y - cy, p2.x - cx);
    const ccw = bulge > 0;
    return { cx, cy, R, startAngle, endAngle, ccw };
}

function isPointInArcSpan(x, y, arcParams) {
    const { cx, cy, startAngle, endAngle, ccw } = arcParams;
    let angle = Math.atan2(y - cy, x - cx);
    let diff = angle - startAngle;
    while(diff < -Math.PI) diff += 2*Math.PI;
    while(diff > Math.PI) diff -= 2*Math.PI;
    
    let span = endAngle - startAngle;
    while(span <= -Math.PI) span += 2*Math.PI;
    while(span > Math.PI) span -= 2*Math.PI;
    if (ccw && span < 0) span += 2*Math.PI;
    if (!ccw && span > 0) span -= 2*Math.PI;
    
    if (ccw) {
        return (diff >= -1e-5 && diff <= span + 1e-5);
    } else {
        return (diff <= 1e-5 && diff >= span - 1e-5);
    }
}

function distToArc(x, y, arcParams) {
    if (!arcParams) return Infinity;
    const { cx, cy, R, startAngle, endAngle } = arcParams;
    const distToCenter = Math.hypot(x - cx, y - cy);
    
    if (isPointInArcSpan(x, y, arcParams)) {
        return Math.abs(distToCenter - R);
    }
    
    const p1x = cx + R * Math.cos(startAngle);
    const p1y = cy + R * Math.sin(startAngle);
    const p2x = cx + R * Math.cos(endAngle);
    const p2y = cy + R * Math.sin(endAngle);
    return Math.min(Math.hypot(x - p1x, y - p1y), Math.hypot(x - p2x, y - p2y));
}

function getArcMidpoint(arcParams) {
    if (!arcParams) return null;
    const { cx, cy, R, startAngle, endAngle, ccw } = arcParams;
    let span = endAngle - startAngle;
    while(span <= -Math.PI) span += 2*Math.PI;
    while(span > Math.PI) span -= 2*Math.PI;
    if (ccw && span < 0) span += 2*Math.PI;
    if (!ccw && span > 0) span -= 2*Math.PI;
    const midAngle = startAngle + span / 2;
    return { x: cx + R * Math.cos(midAngle), y: cy + R * Math.sin(midAngle) };
}

function distToPolylineSegment(wx, wy, p1, p2, bulge) {
    if (bulge && bulge !== 0) {
        const params = getArcParams(p1, p2, bulge);
        if (params) return distToArc(wx, wy, params);
    }
    return distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y);
}

function distToSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const len_sq = C * C + D * D;
    let param = -1; if (len_sq != 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(x - xx, y - yy);
}

function getClosestGrip(wx, wy) {
    if (!selectedObjects.some(o => o.type === 'polyline')) return null;
    const pl = polylines[(selectedObjects.find(o => o.type === 'polyline') || {}).plIndex];
    if (!pl) return null;
    
    let closestDist = 15 / scale;
    let closestGrip = null;
    
    for (let j = 0; j < pl.points.length; j++) {
        const p = pl.points[j];
        const dist = Math.hypot(p.x - wx, p.y - wy);
        if (dist < closestDist) {
            closestDist = dist;
            closestGrip = { type: 'vertex', index: j };
        }
        
        let nextIdx = j + 1;
        if (nextIdx === pl.points.length) {
            if (pl.closed && pl.points.length > 2) nextIdx = 0;
            else continue;
        }
        const p1 = pl.points[j]; const p2 = pl.points[nextIdx];
        let midW;
        if (p1.bulge && p1.bulge !== 0) {
            const params = getArcParams(p1, p2, p1.bulge);
            if (params) midW = getArcMidpoint(params);
            else midW = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
        } else {
            midW = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
        }
        const distMid = Math.hypot(midW.x - wx, midW.y - wy);
        if (distMid < closestDist) {
            closestDist = distMid;
            closestGrip = { type: 'midpoint', index: j };
        }
    }
    return closestGrip;
}

function getClosestSegment(wx, wy) {
    // 1. Check Labels FIRST (Highest Priority)
    for (let i = 0; i < labels.length; i++) {
        const lbl = labels[i];
        if (!layers[lbl.layer] || !layers[lbl.layer].visible) continue;
        const segData = getSegmentData(lbl.plIndex, lbl.segmentIndex);
        if (!segData) continue;
        const midX = (segData.p1.x + segData.p2.x) / 2; const midY = (segData.p1.y + segData.p2.y) / 2;
        const dist = Math.hypot(midX - wx, midY - wy);
        if (dist < 15 / scale) return { type: 'label', index: i }; // Return immediately if label hit
    }

    let closestDist = 15 / scale;
    let closestInfo = null;
    
    // 2. Check pages (anchor click or corners)
    for (let i = pages.length - 1; i >= 0; i--) {
        const p = pages[i];
        const dim = getPageWorldDimensions(p);
        const tl = getPageTopLeft(p);
        
        const dists = [
            Math.hypot(p.x - wx, p.y - wy), // anchor
            Math.hypot(tl.x - wx, tl.y - wy), // top-left
            Math.hypot(tl.x + dim.w - wx, tl.y - wy), // top-right
            Math.hypot(tl.x - wx, tl.y - dim.h - wy), // bottom-left
            Math.hypot(tl.x + dim.w - wx, tl.y - dim.h - wy) // bottom-right
        ];
        
        const minDist = Math.min(...dists);
        if (minDist < 15 / scale && minDist < closestDist) {
            closestDist = minDist;
            closestInfo = { type: 'page', index: i };
        }
    }
    
    // 3. Check polylines
    for (let i = 0; i < polylines.length; i++) {
        const pl = polylines[i];
        if (!layers[pl.layer].visible) continue;
        for (let j = 0; j < pl.points.length - 1; j++) {
            const p1 = pl.points[j]; const p2 = pl.points[j+1];
            const dist = distToPolylineSegment(wx, wy, p1, p2, p1.bulge);
            if (dist < closestDist) { closestDist = dist; closestInfo = { plIndex: i, segmentIndex: j }; }
        }
        if (pl.closed && pl.points.length > 2) {
            const p1 = pl.points[pl.points.length - 1]; const p2 = pl.points[0];
            const dist = distToPolylineSegment(wx, wy, p1, p2, p1.bulge);
            if (dist < closestDist) { closestDist = dist; closestInfo = { plIndex: i, segmentIndex: pl.points.length - 1 }; }
        }
    }
    return closestInfo;
}

function getPerpendicularPoint(px, py, A, B, bulge = 0) {
    if (!bulge || bulge === 0) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return null;
        const t = ((px - A.x) * dx + (py - A.y) * dy) / lenSq;
        if (t >= 0 && t <= 1) {
            return { x: A.x + t * dx, y: A.y + t * dy };
        }
    }
    return null;
}

function getExtensionPoint(wx, wy, A, B, bulge = 0) {
    if (!bulge || bulge === 0) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return null;
        const t = ((wx - A.x) * dx + (wy - A.y) * dy) / lenSq;
        if (t < -0.01 || t > 1.01) {
            const extX = A.x + t * dx;
            const extY = A.y + t * dy;
            if (Math.hypot(extX - wx, extY - wy) < 15 / scale) {
                return { x: extX, y: extY };
            }
        }
    }
    return null;
}

function getLineIntersection(A, B, C, D) {
    const denom = (A.x - B.x)*(C.y - D.y) - (A.y - B.y)*(C.x - D.x);
    if (Math.abs(denom) < 1e-6) return null; // Parallel
    const t = ((A.x - C.x)*(C.y - D.y) - (A.y - C.y)*(C.x - D.x)) / denom;
    const u = ((A.x - C.x)*(A.y - B.y) - (A.y - C.y)*(A.x - B.x)) / denom;
    if (t >= -0.01 && t <= 1.01 && u >= -0.01 && u <= 1.01) {
        return { x: A.x + t*(B.x - A.x), y: A.y + t*(B.y - A.y) };
    }
    return null;
}

function getLineArcIntersection(p1, p2, arc) {
    const dx = p2.x - p1.x; const dy = p2.y - p1.y;
    const fx = p1.x - arc.cx; const fy = p1.y - arc.cy;
    const a = dx*dx + dy*dy;
    const b = 2 * (fx*dx + fy*dy);
    const c = fx*fx + fy*fy - arc.R*arc.R;
    
    let discriminant = b*b - 4*a*c;
    if (discriminant < 0) return [];
    
    let intersections = [];
    discriminant = Math.sqrt(discriminant);
    let t1 = (-b - discriminant) / (2*a);
    let t2 = (-b + discriminant) / (2*a);
    
    if (t1 >= -0.01 && t1 <= 1.01) {
        let pt = {x: p1.x + t1*dx, y: p1.y + t1*dy};
        if (isPointInArcSpan(pt.x, pt.y, arc)) intersections.push(pt);
    }
    if (t2 >= -0.01 && t2 <= 1.01) {
        let pt = {x: p1.x + t2*dx, y: p1.y + t2*dy};
        if (isPointInArcSpan(pt.x, pt.y, arc)) intersections.push(pt);
    }
    return intersections;
}

function getArcArcIntersection(arc1, arc2) {
    const dx = arc2.cx - arc1.cx; const dy = arc2.cy - arc1.cy;
    const d = Math.hypot(dx, dy);
    
    if (d > arc1.R + arc2.R) return [];
    if (d < Math.abs(arc1.R - arc2.R)) return [];
    if (d === 0 && arc1.R === arc2.R) return [];
    
    const a = (arc1.R*arc1.R - arc2.R*arc2.R + d*d) / (2*d);
    let hSq = arc1.R*arc1.R - a*a;
    if (hSq < 0) hSq = 0; // Floating point error
    const h = Math.sqrt(hSq);
    
    const cx2 = arc1.cx + a * (dx / d);
    const cy2 = arc1.cy + a * (dy / d);
    
    const intersections = [];
    const pt1 = { x: cx2 + h * (dy / d), y: cy2 - h * (dx / d) };
    const pt2 = { x: cx2 - h * (dy / d), y: cy2 + h * (dx / d) };
    
    if (isPointInArcSpan(pt1.x, pt1.y, arc1) && isPointInArcSpan(pt1.x, pt1.y, arc2)) {
        intersections.push(pt1);
    }
    if (d > 0 && h > 0) {
        if (isPointInArcSpan(pt2.x, pt2.y, arc1) && isPointInArcSpan(pt2.x, pt2.y, arc2)) {
            intersections.push(pt2);
        }
    }
    return intersections;
}

function getSnapPoint(wx, wy, refPoint = null) {
    if (!snapToggle.checked) return null;
    const SNAP_DIST_WORLD = 15 / scale;
    let minDists = { endpoint: SNAP_DIST_WORLD, midpoint: SNAP_DIST_WORLD, center: SNAP_DIST_WORLD, intersection: SNAP_DIST_WORLD, perpendicular: SNAP_DIST_WORLD, extension: SNAP_DIST_WORLD, grid: SNAP_DIST_WORLD };
    let bestSnaps = { endpoint: null, midpoint: null, center: null, intersection: null, perpendicular: null, extension: null, grid: null };
    let closeSegments = [];

    const checkPoint = (p, type, data = null) => {
        if (!p) return;
        const dist = Math.hypot(p.x - wx, p.y - wy);
        if (dist < minDists[type]) {
            minDists[type] = dist;
            bestSnaps[type] = { x: p.x, y: p.y, type: type, data: data };
        }
    };

    const processPolyline = (pl) => {
        if (pl.layer && layers[pl.layer] && !layers[pl.layer].visible) return;
        for (let i = 0; i < pl.points.length; i++) {
            const p1 = pl.points[i];
            checkPoint(p1, 'endpoint');
            
            let p2 = null;
            if (i < pl.points.length - 1) p2 = pl.points[i + 1];
            else if (pl.closed && pl.points.length > 2) p2 = pl.points[0];
            
            if (p2) {
                if (p1.bulge && p1.bulge !== 0) {
                    const arc = getArcParams(p1, p2, p1.bulge);
                    if (arc) {
                        checkPoint(getArcMidpoint(arc), 'midpoint');
                        checkPoint({x: arc.cx, y: arc.cy}, 'center');
                        if (refPoint) {
                            const angle = Math.atan2(refPoint.y - arc.cy, refPoint.x - arc.cx);
                            const perp1 = { x: arc.cx + arc.R * Math.cos(angle), y: arc.cy + arc.R * Math.sin(angle) };
                            const perp2 = { x: arc.cx - arc.R * Math.cos(angle), y: arc.cy - arc.R * Math.sin(angle) };
                            checkPoint(perp1, 'perpendicular');
                            checkPoint(perp2, 'perpendicular');
                        }
                        const distToArcCenter = Math.hypot(wx - arc.cx, wy - arc.cy);
                        if (Math.abs(distToArcCenter - arc.R) < SNAP_DIST_WORLD * 4) {
                            closeSegments.push({p1, p2, isArc: true, arcParams: arc});
                        }
                    }
                } else {
                    checkPoint({ x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 }, 'midpoint');
                    if (refPoint) {
                        const perp = getPerpendicularPoint(refPoint.x, refPoint.y, p1, p2, 0);
                        if (perp) checkPoint(perp, 'perpendicular');
                    }
                    const ext = getExtensionPoint(wx, wy, p1, p2, 0);
                    if (ext) checkPoint(ext, 'extension', {p1, p2});
                    
                    const distToSeg = distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y);
                    if (distToSeg < SNAP_DIST_WORLD * 4) {
                        closeSegments.push({p1, p2, isArc: false});
                    }
                }
            }
        }
    };

    for (const pl of polylines) processPolyline(pl);
    if (currentPolyline) processPolyline(currentPolyline);
    
    // Check intersections among close segments
    for (let i = 0; i < closeSegments.length; i++) {
        for (let j = i + 1; j < closeSegments.length; j++) {
            const seg1 = closeSegments[i];
            const seg2 = closeSegments[j];
            let inters = [];
            
            if (!seg1.isArc && !seg2.isArc) {
                const pt = getLineIntersection(seg1.p1, seg1.p2, seg2.p1, seg2.p2);
                if (pt) inters.push(pt);
            } else if (seg1.isArc && !seg2.isArc) {
                inters = getLineArcIntersection(seg2.p1, seg2.p2, seg1.arcParams);
            } else if (!seg1.isArc && seg2.isArc) {
                inters = getLineArcIntersection(seg1.p1, seg1.p2, seg2.arcParams);
            } else {
                inters = getArcArcIntersection(seg1.arcParams, seg2.arcParams);
            }
            
            inters.forEach(pt => checkPoint(pt, 'intersection'));
        }
    }
    
    if (workspaceSettings.grid.enabled && workspaceSettings.grid.type === 'absolute') {
        const rad = workspaceSettings.grid.angle * Math.PI / 180;
        const unrot = rotatePoint(wx, wy, -rad);
        const gx = workspaceSettings.grid.sizeX; const gy = workspaceSettings.grid.sizeY;
        const nearestX = Math.round(unrot.x / gx) * gx; const nearestY = Math.round(unrot.y / gy) * gy;
        const trueWorld = rotatePoint(nearestX, nearestY, rad);
        checkPoint(trueWorld, 'grid');
    }

    if (bestSnaps.intersection) return bestSnaps.intersection;
    if (bestSnaps.endpoint) return bestSnaps.endpoint;
    if (bestSnaps.midpoint) return bestSnaps.midpoint;
    if (bestSnaps.center) return bestSnaps.center;
    if (bestSnaps.perpendicular) return bestSnaps.perpendicular;
    if (bestSnaps.extension) return bestSnaps.extension;
    if (bestSnaps.grid) return bestSnaps.grid;
    
    return null;
}

function updateWorldCoordinates(rawWx, rawWy) {
    rawWorldX = rawWx; rawWorldY = rawWy;
    
    let isOrthoApplicable = false;
    let refPoint = null;
    
    if (currentTool === 'polyline' && currentPolyline && currentPolyline.points.length > 0) {
        refPoint = currentPolyline.points[currentPolyline.points.length - 1];
        isOrthoApplicable = true;
    } else if (currentTool === 'move' && moveState === 'DESTINATION' && moveOrigin) {
        refPoint = moveOrigin;
        isOrthoApplicable = true;
    } else if (currentTool === 'rotate' && rotateState === 'ANGLE' && rotateOrigin) {
        refPoint = rotateOrigin;
        isOrthoApplicable = true;
    }

    snapPoint = getSnapPoint(rawWx, rawWy, refPoint);
    worldX = rawWx; worldY = rawWy;
    
    if (isOrthoApplicable) {
        let dx = rawWx - refPoint.x; let dy = rawWy - refPoint.y;
        let orthoAngle = parseFloat(orthoAngleInput.value);
        if (isNaN(orthoAngle) || orthoAngle <= 0) orthoAngle = 90;
        const orthoRad = orthoAngle * Math.PI / 180;
        
        if (currentTool === 'polyline' && typedLength !== '') {
            const length = parseFloat(typedLength);
            if (!isNaN(length)) {
                let angle = Math.atan2(dy, dx);
                if (orthoToggle.checked) angle = Math.round(angle / orthoRad) * orthoRad;
                worldX = refPoint.x + length * Math.cos(angle);
                worldY = refPoint.y + length * Math.sin(angle);
                snapPoint = null;
                return;
            }
        }
        
        if (snapPoint) {
            worldX = snapPoint.x; worldY = snapPoint.y;
        } else if (orthoToggle.checked) {
            let angle = Math.atan2(dy, dx);
            angle = Math.round(angle / orthoRad) * orthoRad;
            const dist = Math.hypot(dx, dy);
            worldX = refPoint.x + dist * Math.cos(angle);
            worldY = refPoint.y + dist * Math.sin(angle);
        }
    } else {
        if (snapPoint && typedLength === '') { worldX = snapPoint.x; worldY = snapPoint.y; }
    }
}

// Properties & Deletion
function updatePropertiesPanel() {
    if (!selectedObjects || selectedObjects.length === 0) {
        propertiesPanel.style.display = 'none';
        return;
    }
    propertiesPanel.style.display = 'block';
    
    const types = new Set(selectedObjects.map(o => o.type));
    
    if (types.size > 1) {
        propType.textContent = 'Selección Mixta (' + selectedObjects.length + ')';
        propLayerContainer.style.display = 'none';
        propLengthContainer.style.display = 'none';
        propLblSizeContainer.style.display = 'none';
        propLblPrecContainer.style.display = 'none';
        propPageContainer.style.display = 'none';
        
        if (!types.has('page')) {
            propLayerContainer.style.display = 'block';
            let firstLayer = null;
            let mixedLayer = false;
            selectedObjects.forEach(o => {
                const layer = o.type === 'polyline' ? polylines[o.plIndex].layer : (labels[o.index].layer || '0');
                if (firstLayer === null) firstLayer = layer;
                else if (firstLayer !== layer) mixedLayer = true;
            });
            propLayer.value = mixedLayer ? '' : firstLayer;
        }
        return;
    }
    
    const type = Array.from(types)[0];
    
    if (type === 'page') {
        propType.textContent = selectedObjects.length > 1 ? 'Páginas (' + selectedObjects.length + ')' : 'Página (Layout)';
        propLayerContainer.style.display = 'none';
        propLengthContainer.style.display = 'none';
        propLblSizeContainer.style.display = 'none';
        propLblPrecContainer.style.display = 'none';
        propPageContainer.style.display = 'flex';
        btnEditPage.style.display = selectedObjects.length === 1 ? 'block' : 'none';
    } else if (type === 'polyline') {
        propType.textContent = selectedObjects.length > 1 ? 'Polilíneas (' + selectedObjects.length + ')' : 'Polilínea'; 
        propLayerContainer.style.display = 'block';
        propLengthContainer.style.display = selectedObjects.length === 1 ? 'block' : 'none';
        propLblSizeContainer.style.display = 'none';
        propLblPrecContainer.style.display = 'none';
        propPageContainer.style.display = 'none';
        
        let firstLayer = null;
        let mixedLayer = false;
        selectedObjects.forEach(o => {
            const layer = polylines[o.plIndex].layer;
            if (firstLayer === null) firstLayer = layer;
            else if (firstLayer !== layer) mixedLayer = true;
        });
        propLayer.value = mixedLayer ? '' : firstLayer;
        
        if (selectedObjects.length === 1) {
            const pl = polylines[(selectedObjects.find(o => o.type === 'polyline') || {}).plIndex];
            let l = 0;
            for (let i = 0; i < pl.points.length - 1; i++) {
                l += Math.hypot(pl.points[i+1].x - pl.points[i].x, pl.points[i+1].y - pl.points[i].y);
            }
            propLength.textContent = (l * documentSettings.scale).toFixed(2);
        }
    } else if (type === 'label') {
        propType.textContent = selectedObjects.length > 1 ? 'Etiquetas (' + selectedObjects.length + ')' : 'Etiqueta';
        propLayerContainer.style.display = 'block';
        propLengthContainer.style.display = 'none';
        propLblSizeContainer.style.display = 'block';
        propLblPrecContainer.style.display = 'block';
        propPageContainer.style.display = 'none';
        
        let firstLayer = null, mixedLayer = false;
        let firstSize = null, mixedSize = false;
        let firstPrec = null, mixedPrec = false;
        
        selectedObjects.forEach(o => {
            const lbl = labels[o.index];
            if (!lbl) return;
            const layer = lbl.layer || '0';
            const size = lbl.printSize || 5;
            const prec = lbl.precision !== undefined ? lbl.precision : '';
            
            if (firstLayer === null) firstLayer = layer; else if (firstLayer !== layer) mixedLayer = true;
            if (firstSize === null) firstSize = size; else if (firstSize !== size) mixedSize = true;
            if (firstPrec === null) firstPrec = prec; else if (firstPrec !== prec) mixedPrec = true;
        });
        
        propLayer.value = mixedLayer ? '' : firstLayer;
        propLblSize.value = mixedSize ? '' : firstSize;
        propLblPrec.value = mixedPrec ? '' : firstPrec;
    }
}

propLayer.addEventListener('change', (e) => {
    if (!selectedObjects.length) return;
    const val = e.target.value;
    if (!val) return;
    selectedObjects.forEach(o => {
        if (o.type === 'polyline') polylines[o.plIndex].layer = val;
        else if (o.type === 'label') labels[o.index].layer = val;
    });
    draw();
});
propLblSize.addEventListener('change', (e) => {
    if (!selectedObjects.length) return;
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    selectedObjects.forEach(o => {
        if (o.type === 'label') labels[o.index].printSize = val;
    });
    draw();
});
propLblPrec.addEventListener('change', (e) => {
    if (!selectedObjects.length) return;
    const valStr = e.target.value;
    selectedObjects.forEach(o => {
        if (o.type === 'label') {
            if (valStr === '') delete labels[o.index].precision;
            else labels[o.index].precision = parseInt(valStr) || 0;
        }
    });
    draw();
});
btnEditPage.addEventListener('click', () => {
    if (selectedObjects.length === 1 && selectedObjects[0].type === 'page') {
        openPageModal(selectedObjects[0].index);
    }
});
if (btnDelete) btnDelete.addEventListener('click', deleteSelected);
const btnCopy = document.getElementById('btn-copy');
if (btnCopy) btnCopy.addEventListener('click', copySelected);
const btnPaste = document.getElementById('btn-paste');
if (btnPaste) btnPaste.addEventListener('click', pasteClipboard);

function copySelected() {
    if (selectedObjects.length > 0) {
        clipboard = selectedObjects.map(o => {
            if (o.type === 'polyline') {
                const pl = polylines[o.plIndex];
                return { type: 'polyline', data: JSON.parse(JSON.stringify(pl)), layerInfo: layers[pl.layer] };
            }
            if (o.type === 'label') {
                const lbl = labels[o.index];
                return { type: 'label', data: JSON.parse(JSON.stringify(lbl)), layerInfo: layers[lbl.layer || '0'] };
            }
            if (o.type === 'page') return { type: 'page', data: JSON.parse(JSON.stringify(pages[o.index])) };
            return null;
        }).filter(o => o !== null);
        console.log('Copiado al portapapeles multiverso', clipboard.length);
    }
}

function pasteClipboard() {
    if (clipboard.length > 0) {
        selectedObjects = [];
        let layersChanged = false;
        clipboard.forEach(c => {
            const clonedData = JSON.parse(JSON.stringify(c.data));
            
            if (c.layerInfo) {
                const layerName = clonedData.layer || '0';
                if (!layers[layerName]) {
                    layers[layerName] = JSON.parse(JSON.stringify(c.layerInfo));
                    layersChanged = true;
                }
            }

            if (c.type === 'polyline') {
                polylines.push(clonedData);
                selectedObjects.push({ type: 'polyline', plIndex: polylines.length - 1 });
            } else if (c.type === 'label') {
                labels.push(clonedData);
                selectedObjects.push({ type: 'label', index: labels.length - 1 });
            } else if (c.type === 'page') {
                pages.push(clonedData);
                selectedObjects.push({ type: 'page', index: pages.length - 1 });
            }
        });
        if (layersChanged) updateLayersPanel();
        updatePropertiesPanel();
        draw();
        commitTimeMap('Pegado múltiple desde portapapeles');
    }
}
function deleteSelected() {
    if (!selectedObjects || selectedObjects.length === 0) return;
    
    const plsToDelete = selectedObjects.filter(o => o.type === 'polyline').map(o => o.plIndex).sort((a,b)=>b-a);
    const lblsToDelete = selectedObjects.filter(o => o.type === 'label').map(o => o.index).sort((a,b)=>b-a);
    const pagesToDelete = selectedObjects.filter(o => o.type === 'page').map(o => o.index).sort((a,b)=>b-a);
    
    plsToDelete.forEach(idx => { polylines[idx].layer = 'basura'; });
    lblsToDelete.forEach(idx => { labels.splice(idx, 1); });
    pagesToDelete.forEach(idx => { pages.splice(idx, 1); });
    
    selectedObjects = [];
    updatePropertiesPanel();
    draw();
    commitTimeMap('Borrado múltiple');
}


// Events
let draggingPage = null;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const rawWorld = screenToWorld(mouseX, mouseY);
    updateWorldCoordinates(rawWorld.x, rawWorld.y);
    coordBar.textContent = `X: ${worldX.toFixed(4)}, Y: ${worldY.toFixed(4)}`;
    
    if (draggingPage !== null) {
        pages[draggingPage].x = worldX;
        pages[draggingPage].y = worldY;
    }
    
    draw();
});

canvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('#settings-panel') || e.target.closest('#btn-settings')) return;
    
    if (e.button === 1 || (e.button === 0 && currentTool === 'select' && !getClosestSegment(worldX, worldY))) {
        let isDragging = true; let lastX = e.clientX; let lastY = e.clientY;
        const onMouseMove = (moveEvent) => {
            if (isDragging) { panX += (moveEvent.clientX - lastX); panY += (moveEvent.clientY - lastY); lastX = moveEvent.clientX; lastY = moveEvent.clientY; draw(); }
        };
        const onMouseUp = () => { isDragging = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        
        return;
    }

    if (e.button === 0) {
        if (currentTool === 'polyline') {
            if (!currentPolyline) currentPolyline = { layer: currentLayer, points: [], closed: false };
            if (currentPolyline.points.length >= 2) {
                const firstPt = currentPolyline.points[0];
                if (Math.hypot(worldX - firstPt.x, worldY - firstPt.y) < 1e-4) {
                    if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
                    currentPolyline.closed = true;
                    polylines.push(currentPolyline);
                    commitTimeMap('Forma creada');
                    currentPolyline = null;
                    polylineMode = 'line';
                    typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
                    return;
                }
            }
            if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
            currentPolyline.points.push({ x: worldX, y: worldY });
            typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
        } else if (currentTool === 'select') {
            const gripHit = getClosestGrip(worldX, worldY);
            if (gripHit) {
                let draggingGrip = gripHit;
                const pl = polylines[(selectedObjects.find(o => o.type === 'polyline') || {}).plIndex];
                
                const onMouseMoveGrip = (eMove) => {
                    if (draggingGrip.type === 'vertex') {
                        pl.points[draggingGrip.index].x = worldX;
                        pl.points[draggingGrip.index].y = worldY;
                    } else if (draggingGrip.type === 'midpoint') {
                        let nextIdx = draggingGrip.index + 1;
                        if (nextIdx === pl.points.length) nextIdx = 0;
                        const p1 = pl.points[draggingGrip.index];
                        const p2 = pl.points[nextIdx];
                        
                        const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                        if (L > 1e-5) {
                            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                            const cross = dx * (worldY - p1.y) - dy * (worldX - p1.x);
                            const h = cross / L;
                            pl.points[draggingGrip.index].bulge = - (2 * h) / L;
                        }
                    }
                    draw();
                };
                const onMouseUpGrip = () => {
                    document.removeEventListener('mousemove', onMouseMoveGrip);
                    document.removeEventListener('mouseup', onMouseUpGrip);
                    updatePropertiesPanel();
                    commitTimeMap('Geometría modificada (Grips)');
                };
                document.addEventListener('mousemove', onMouseMoveGrip);
                document.addEventListener('mouseup', onMouseUpGrip);
                return;
            }

            const hit = getClosestSegment(worldX, worldY);
            if (hit) {
                let hitObj = null;
                if (hit.type === 'page') hitObj = { type: 'page', index: hit.index };
                else if (hit.type === 'label') hitObj = { type: 'label', index: hit.index };
                else hitObj = { type: 'polyline', plIndex: hit.plIndex, segmentIndex: hit.segmentIndex };
                
                if (e.shiftKey) {
                    const existingIdx = selectedObjects.findIndex(o => 
                        o.type === hitObj.type && 
                        (o.type === 'polyline' ? o.plIndex === hitObj.plIndex : o.index === hitObj.index)
                    );
                    if (existingIdx >= 0) selectedObjects.splice(existingIdx, 1);
                    else selectedObjects.push(hitObj);
                } else {
                    const isAlreadySelected = selectedObjects.some(o => 
                        o.type === hitObj.type && 
                        (o.type === 'polyline' ? o.plIndex === hitObj.plIndex : o.index === hitObj.index)
                    );
                    if (!isAlreadySelected) {
                        selectedObjects = [hitObj];
                    }
                }
                
                if (hit.type === 'page' && selectedObjects.length === 1 && selectedObjects[0].type === 'page') {
                    draggingPage = hit.index;
                    const origX = pages[hit.index].x;
                    const origY = pages[hit.index].y;
                    const onMouseMovePage = (moveEvent) => {
                        pages[draggingPage].x = worldX;
                        pages[draggingPage].y = worldY;
                        draw();
                    };
                    document.addEventListener('mousemove', onMouseMovePage);
                    const onMouseUpPage = (eUp) => {
                        if (eUp.ctrlKey) {
                            const newPage = JSON.parse(JSON.stringify(pages[draggingPage]));
                            pages[draggingPage].x = origX;
                            pages[draggingPage].y = origY;
                            pages.push(newPage);
                            selectedObjects = [{ type: 'page', index: pages.length - 1 }];
                            commitTimeMap('Página clonada');
                        } else if (pages[draggingPage].x !== origX || pages[draggingPage].y !== origY) {
                            commitTimeMap('Página movida');
                        }
                        draggingPage = null; 
                        document.removeEventListener('mousemove', onMouseMovePage);
                        document.removeEventListener('mouseup', onMouseUpPage);
                        updatePropertiesPanel();
                        draw();
                    };
                    document.addEventListener('mouseup', onMouseUpPage);
                }
            } else {
                if (!e.shiftKey) {
                    selectedObjects = [];
                }
            }
            updatePropertiesPanel();
            draw();
        } else if (currentTool === 'label') {
            const hit = getClosestSegment(worldX, worldY);
            if (hit && !hit.type) {
                const text = prompt("Ingrese el texto (use #longitud# o #capa# para variables):", "L = #longitud#");
                if (text) { labels.push({ text: text, plIndex: hit.plIndex, segmentIndex: hit.segmentIndex, layer: currentLayer }); commitTimeMap('Etiqueta creada'); draw(); }
            }
        } else if (currentTool === 'move') {
            if (moveState === 'SELECTING') {
                const hit = getClosestSegment(worldX, worldY);
                if (hit && !hit.type) {
                    const idx = moveSelection.findIndex(s => s.type === 'polyline' && s.index === hit.plIndex);
                    if (idx === -1) moveSelection.push({ type: 'polyline', index: hit.plIndex });
                    else moveSelection.splice(idx, 1);
                } else if (hit && hit.type === 'label') {
                    const idx = moveSelection.findIndex(s => s.type === 'label' && s.index === hit.index);
                    if (idx === -1) moveSelection.push({ type: 'label', index: hit.index });
                    else moveSelection.splice(idx, 1);
                }
                draw();
            } else if (moveState === 'ORIGIN') {
                moveOrigin = { x: worldX, y: worldY };
                moveState = 'DESTINATION';
                draw();
            } else if (moveState === 'DESTINATION') {
                moveDest = { x: worldX, y: worldY };
                moveState = 'ADJUSTING';
                moveModifier = ''; moveCommandInput = '';
                typedLength = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = '';
                draw();
            }
        } else if (currentTool === 'rotate') {
            if (rotateState === 'SELECTING') {
                const hit = getClosestSegment(worldX, worldY);
                if (hit && !hit.type) {
                    const idx = rotateSelection.findIndex(s => s.type === 'polyline' && s.index === hit.plIndex);
                    if (idx === -1) rotateSelection.push({ type: 'polyline', index: hit.plIndex });
                    else rotateSelection.splice(idx, 1);
                } else if (hit && hit.type === 'label') {
                    const idx = rotateSelection.findIndex(s => s.type === 'label' && s.index === hit.index);
                    if (idx === -1) rotateSelection.push({ type: 'label', index: hit.index });
                    else rotateSelection.splice(idx, 1);
                }
                draw();
            } else if (rotateState === 'ORIGIN') {
                rotateOrigin = { x: worldX, y: worldY };
                rotateState = 'REFERENCE';
                draw();
            } else if (rotateState === 'REFERENCE') {
                rotateReference = { x: worldX, y: worldY };
                rotateState = 'ANGLE';
                rotateModifier = ''; rotateCommandInput = '';
                typedLength = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = '';
                draw();
            } else if (rotateState === 'ANGLE') {
                rotateTargetPoint = { x: worldX, y: worldY };
                rotateState = 'ADJUSTING';
                draw();
            } else if (rotateState === 'ADJUSTING') {
                commitRotate(rotateTargetPoint.x, rotateTargetPoint.y);
            }
        }
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (currentTool === 'polyline' && currentPolyline) {
        if (currentPolyline.points.length > 1) {
            polylines.push(currentPolyline);
            commitTimeMap('Polilínea terminada (Click derecho)');
        }
        currentPolyline = null; typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    if (e.target.closest('#settings-panel')) return;
    e.preventDefault();
    const zoomIntensity = 0.1; const wheel = e.deltaY < 0 ? 1 : -1; const zoom = Math.exp(wheel * zoomIntensity);
    panX = mouseX - (mouseX - panX) * zoom; panY = mouseY - (mouseY - panY) * zoom; scale *= zoom; draw();
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        btnPrint.click();
        return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (timeMap.activeNodeId && timeMap.nodes[timeMap.activeNodeId]) {
            const current = timeMap.nodes[timeMap.activeNodeId];
            if (current.parentId) {
                checkoutNode(current.parentId);
            }
        }
        return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!setGridEnable.checked) { setGridEnable.checked = true; gridSettingsDiv.style.display = 'block'; }
        let gx = parseFloat(setGridX.value) || 10;
        let gy = parseFloat(setGridY.value) || 10;
        let rad = (parseFloat(setGridAngle.value) || 0) * Math.PI / 180;
        
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = gy;
        else if (e.key === 'ArrowDown') dy = -gy;
        else if (e.key === 'ArrowLeft') dx = -gx;
        else if (e.key === 'ArrowRight') dx = gx;
        
        let stepX = dx * Math.cos(rad) - dy * Math.sin(rad);
        let stepY = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        let startPt = getSnapPoint(rawWorldX, rawWorldY) || {x: rawWorldX, y: rawWorldY};
        updateWorldCoordinates(startPt.x + stepX, startPt.y + stepY);
        draw();
        return;
    }

    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (currentTool === 'move') {
            if (moveState === 'SELECTING') { moveState = 'ORIGIN'; draw(); }
            else if (moveState === 'ORIGIN') { moveOrigin = { x: worldX, y: worldY }; moveState = 'DESTINATION'; draw(); }
            else if (moveState === 'DESTINATION') { moveDest = { x: worldX, y: worldY }; moveState = 'ADJUSTING'; moveModifier = ''; moveCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (moveState === 'ADJUSTING') {
                if (moveCommandInput !== '') {
                    if (moveCommandInput.startsWith('/') || moveCommandInput.startsWith('*')) {
                        moveModifier = moveCommandInput;
                        isCopyMode = true;
                    } else {
                        const d = parseFloat(moveCommandInput);
                        if (!isNaN(d)) {
                            let V = { x: moveDest.x - moveOrigin.x, y: moveDest.y - moveOrigin.y };
                            let currentLen = Math.hypot(V.x, V.y);
                            if (currentLen > 0) {
                                moveDest = { x: moveOrigin.x + (V.x/currentLen)*d, y: moveOrigin.y + (V.y/currentLen)*d };
                            }
                        }
                    }
                    moveCommandInput = '';
                    lengthInput.value = '';
                    draw();
                } else {
                    commitMoveCopy();
                }
            }
            return;
        } else if (currentTool === 'rotate') {
            if (rotateState === 'SELECTING') { rotateState = 'ORIGIN'; draw(); }
            else if (rotateState === 'ORIGIN') { rotateOrigin = { x: worldX, y: worldY }; rotateState = 'REFERENCE'; draw(); }
            else if (rotateState === 'REFERENCE') { rotateReference = { x: worldX, y: worldY }; rotateState = 'ANGLE'; rotateModifier = ''; rotateCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (rotateState === 'ANGLE') { rotateTargetPoint = { x: worldX, y: worldY }; rotateState = 'ADJUSTING'; rotateModifier = ''; rotateCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (rotateState === 'ADJUSTING') {
                if (rotateCommandInput !== '') {
                    if (rotateCommandInput.startsWith('/') || rotateCommandInput.startsWith('*')) {
                        rotateModifier = rotateCommandInput;
                        isCopyMode = true;
                    } else {
                        const ang = parseFloat(rotateCommandInput);
                        if (!isNaN(ang)) {
                            let refAngle = 0;
                            if (rotateReference) refAngle = Math.atan2(rotateReference.y - rotateOrigin.y, rotateReference.x - rotateOrigin.x);
                            const finalAngle = refAngle + (ang * Math.PI / 180);
                            rotateTargetPoint = {
                                x: rotateOrigin.x + Math.cos(finalAngle) * 10,
                                y: rotateOrigin.y + Math.sin(finalAngle) * 10
                            };
                        }
                    }
                    rotateCommandInput = '';
                    lengthInput.value = '';
                    draw();
                } else {
                    commitRotate(rotateTargetPoint.x, rotateTargetPoint.y);
                }
            }
            return;
        }

        if (currentTool !== 'polyline') {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            const btnPolyline = document.getElementById('tool-polyline');
            if (btnPolyline) btnPolyline.classList.add('active');
            currentTool = 'polyline';
            currentPolyline = null;
            selectedObjects = [];
            updatePropertiesPanel();
            
            if (lastUsedPoint) {
                let startPt = getSnapPoint(lastUsedPoint.x, lastUsedPoint.y) || {x: lastUsedPoint.x, y: lastUsedPoint.y};
                updateWorldCoordinates(startPt.x, startPt.y);
            } else {
                updateWorldCoordinates(rawWorldX, rawWorldY);
            }
            draw();
        } else {
            if (!currentPolyline) currentPolyline = { layer: currentLayer, points: [], closed: false };
            if (currentPolyline.points.length >= 2) {
                const firstPt = currentPolyline.points[0];
                if (Math.hypot(worldX - firstPt.x, worldY - firstPt.y) < 1e-4) {
                    if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
                    currentPolyline.closed = true;
                    polylines.push(currentPolyline);
                    commitTimeMap('Forma creada');
                    currentPolyline = null;
                    polylineMode = 'line';
                    typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
                    return;
                }
            }
            if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
            currentPolyline.points.push({ x: worldX, y: worldY });
            lastUsedPoint = { x: worldX, y: worldY };
            typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
        }
        return;
    }

    if (currentTool === 'move') {
        if (e.key === 'Control') {
            if (moveState === 'DESTINATION' || moveState === 'ADJUSTING') {
                isCopyMode = !isCopyMode;
                if (!isCopyMode && (moveModifier.startsWith('/') || moveModifier.startsWith('*'))) {
                    moveModifier = '';
                }
                draw();
            }
        } else if (e.key === 'Escape') {
            moveState = 'SELECTING'; moveSelection = []; moveOrigin = null; moveDest = null; moveModifier = ''; moveCommandInput = ''; isCopyMode = false;
            rotateState = 'SELECTING'; rotateSelection = []; rotateOrigin = null; rotateReference = null; rotateModifier = ''; rotateCommandInput = '';
            lengthInputOverlay.style.display = 'none'; draw();
        } else if (e.key === 'Enter') {
            if (moveState === 'SELECTING') { moveState = 'ORIGIN'; draw(); }
            else if (moveState === 'ORIGIN') { moveOrigin = { x: worldX, y: worldY }; moveState = 'DESTINATION'; draw(); }
            else if (moveState === 'DESTINATION') { moveDest = { x: worldX, y: worldY }; moveState = 'ADJUSTING'; moveModifier = ''; moveCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (moveState === 'ADJUSTING') {
                if (moveCommandInput !== '') {
                    if (moveCommandInput.startsWith('/') || moveCommandInput.startsWith('*')) {
                        moveModifier = moveCommandInput;
                        isCopyMode = true;
                    } else {
                        const d = parseFloat(moveCommandInput);
                        if (!isNaN(d)) {
                            let V = { x: moveDest.x - moveOrigin.x, y: moveDest.y - moveOrigin.y };
                            let currentLen = Math.hypot(V.x, V.y);
                            if (currentLen > 0) {
                                moveDest = { x: moveOrigin.x + (V.x/currentLen)*d, y: moveOrigin.y + (V.y/currentLen)*d };
                            }
                        }
                    }
                    moveCommandInput = '';
                    lengthInput.value = '';
                    draw();
                } else {
                    commitMoveCopy();
                }
            }
        } else if (moveState === 'ADJUSTING') {
            if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '-' || e.key === '/' || e.key === '*') {
                moveCommandInput += e.key; lengthInput.value = moveCommandInput; draw();
            } else if (e.key === 'Backspace') {
                moveCommandInput = moveCommandInput.slice(0, -1); lengthInput.value = moveCommandInput; draw();
            }
        }
        return;
    }

    if (currentTool === 'rotate') {
        if (e.key === 'Control') {
            if (rotateState === 'ANGLE' || rotateState === 'ADJUSTING') {
                isCopyMode = !isCopyMode;
                if (!isCopyMode && (rotateModifier.startsWith('/') || rotateModifier.startsWith('*'))) {
                    rotateModifier = '';
                }
                draw();
            }
        } else if (e.key === 'Escape') {
            moveState = 'SELECTING'; moveSelection = []; moveOrigin = null; moveDest = null; moveModifier = ''; moveCommandInput = ''; isCopyMode = false;
            rotateState = 'SELECTING'; rotateSelection = []; rotateOrigin = null; rotateReference = null; rotateTargetPoint = null; rotateModifier = ''; rotateCommandInput = '';
            lengthInputOverlay.style.display = 'none'; draw();
        } else if (e.key === 'Enter') {
            if (rotateState === 'SELECTING') { rotateState = 'ORIGIN'; draw(); }
            else if (rotateState === 'ORIGIN') { rotateOrigin = { x: worldX, y: worldY }; rotateState = 'REFERENCE'; draw(); }
            else if (rotateState === 'REFERENCE') { rotateReference = { x: worldX, y: worldY }; rotateState = 'ANGLE'; rotateModifier = ''; rotateCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (rotateState === 'ANGLE') { rotateTargetPoint = { x: worldX, y: worldY }; rotateState = 'ADJUSTING'; rotateModifier = ''; rotateCommandInput = ''; lengthInputOverlay.style.display = 'flex'; lengthInput.value = ''; draw(); }
            else if (rotateState === 'ADJUSTING') {
                if (rotateCommandInput !== '') {
                    if (rotateCommandInput.startsWith('/') || rotateCommandInput.startsWith('*')) {
                        rotateModifier = rotateCommandInput;
                        isCopyMode = true;
                    } else {
                        const ang = parseFloat(rotateCommandInput);
                        if (!isNaN(ang)) {
                            let refAngle = 0;
                            if (rotateReference) refAngle = Math.atan2(rotateReference.y - rotateOrigin.y, rotateReference.x - rotateOrigin.x);
                            const finalAngle = refAngle + (ang * Math.PI / 180);
                            rotateTargetPoint = {
                                x: rotateOrigin.x + Math.cos(finalAngle) * 10,
                                y: rotateOrigin.y + Math.sin(finalAngle) * 10
                            };
                        }
                    }
                    rotateCommandInput = '';
                    lengthInput.value = '';
                    draw();
                } else {
                    commitRotate(rotateTargetPoint.x, rotateTargetPoint.y);
                }
            }
        } else if (rotateState === 'ANGLE' || rotateState === 'ADJUSTING') {
            if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '-' || e.key === '/' || e.key === '*') {
                rotateCommandInput += e.key; lengthInput.value = rotateCommandInput; draw();
            } else if (e.key === 'Backspace') {
                rotateCommandInput = rotateCommandInput.slice(0, -1); lengthInput.value = rotateCommandInput; draw();
            }
        }
        return;
    }
    if (currentTool === 'polyline') {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
            typedLength += e.key; lengthInput.value = typedLength; lengthInputOverlay.style.display = 'flex'; updateWorldCoordinates(rawWorldX, rawWorldY); draw();
        } else if (e.key === 'Backspace') {
            typedLength = typedLength.slice(0, -1); lengthInput.value = typedLength;
            if (typedLength === '') lengthInputOverlay.style.display = 'none';
            updateWorldCoordinates(rawWorldX, rawWorldY); draw();
        } else if (e.key === 'Enter') {
            if (typedLength !== '' && currentPolyline) {
                if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
                currentPolyline.points.push({ x: worldX, y: worldY }); typedLength = ''; lengthInputOverlay.style.display = 'none'; updateWorldCoordinates(rawWorldX, rawWorldY); draw();
            } else if (currentPolyline) {
                if (currentPolyline.points.length > 1) { polylines.push(currentPolyline); commitTimeMap('Polilínea terminada (Enter)'); }
                currentPolyline = null; polylineMode = 'line'; draw();
            }
        } else if (e.key === 'Escape') {
            typedLength = ''; lengthInputOverlay.style.display = 'none';
            if (currentPolyline) { if (currentPolyline.points.length > 1) { polylines.push(currentPolyline); commitTimeMap('Polilínea interrumpida (Escape)'); } currentPolyline = null; polylineMode = 'line'; }
            draw();
        } else if (e.key.toLowerCase() === 'c') {
            if (currentPolyline && currentPolyline.points.length >= 2) {
                if (currentPolyline.points.length > 0) currentPolyline.points[currentPolyline.points.length - 1].bulge = currentPreviewBulge;
                currentPolyline.closed = true;
                polylines.push(currentPolyline);
                commitTimeMap('Polilínea cerrada (C)');
                currentPolyline = null;
                polylineMode = 'line';
                typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
            }
        } else if (e.key.toLowerCase() === 'a') {
            polylineMode = 'arc'; draw();
        } else if (e.key.toLowerCase() === 'l') {
            polylineMode = 'line'; draw();
        }
    } else if (currentTool === 'select' || currentTool === 'label') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelected();
        } else if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
            copySelected();
        } else if (e.key.toLowerCase() === 'v' && e.ctrlKey) {
            pasteClipboard();
        } else if (e.key === 'Escape') {
            selectedObjects = [];
            updatePropertiesPanel();
            draw();
        }
    }
});

// Render
function getSegmentData(plIndex, segIndex) {
    const pl = polylines[plIndex]; if (!pl) return null;
    const p1 = pl.points[segIndex]; let p2;
    if (segIndex === pl.points.length - 1 && pl.closed) p2 = pl.points[0]; else p2 = pl.points[segIndex + 1];
    if (!p1 || !p2) return null;
    
    let len = 0;
    let midX = 0, midY = 0;
    if (p1.bulge && p1.bulge !== 0) {
        const arc = getArcParams(p1, p2, p1.bulge);
        if (arc) {
            let span = arc.endAngle - arc.startAngle;
            while(span <= -Math.PI) span += 2*Math.PI;
            while(span > Math.PI) span -= 2*Math.PI;
            if (arc.ccw && span < 0) span += 2*Math.PI;
            if (!arc.ccw && span > 0) span -= 2*Math.PI;
            len = Math.abs(span) * arc.R;
            const mid = getArcMidpoint(arc);
            midX = mid.x; midY = mid.y;
        } else {
            len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            midX = (p1.x + p2.x)/2; midY = (p1.y + p2.y)/2;
        }
    } else {
        len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        midX = (p1.x + p2.x)/2; midY = (p1.y + p2.y)/2;
    }
    
    return { p1, p2, len, layer: pl.layer, midX, midY };
}

function parseVars(str, page) {
    if (!str) return '';
    let d = new Date();
    
    // Globales
    str = str.replace(/#doc-unidades#/g, documentSettings.units);
    str = str.replace(/#doc-numero#/g, documentSettings.projNum);
    str = str.replace(/#doc-proyecto#/g, documentSettings.projectName);
    str = str.replace(/#doc-nombre#/g, documentSettings.fileName);
    str = str.replace(/#doc-dibujante#/g, documentSettings.draftsman);
    str = str.replace(/#doc-direccion#/g, documentSettings.address);
    str = str.replace(/#doc-comentario#/g, documentSettings.comments);
    
    // Página
    if (page) {
        str = str.replace(/#pag-nombre#/g, page.name);
        str = str.replace(/#pag-formato#/g, page.format);
        str = str.replace(/#pag-orientacion#/g, page.orient === 'landscape' ? 'Horizontal' : 'Vertical');
        str = str.replace(/#pag-escala#/g, page.scale.toString());
        str = str.replace(/#pag-numero#/g, (pages.indexOf(page) + 1).toString());
    }
    
    // Sistema
    str = str.replace(/#fecha#/g, `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`);
    
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    str = str.replace(/#fecha_corta#/g, `${yy}${mm}${dd}`);
    
    return str;
}

function drawGrid() {
    if (!workspaceSettings.grid.enabled) return;
    ctx.strokeStyle = workspaceSettings.grid.color; ctx.lineWidth = 1;
    if (workspaceSettings.grid.type === 'relative') {
        const gx = Math.max(5, workspaceSettings.grid.sizeX); const gy = Math.max(5, workspaceSettings.grid.sizeY);
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += gx) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (let y = 0; y <= canvas.height; y += gy) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();
    } else {
        const gx = Math.max(0.1, workspaceSettings.grid.sizeX); const gy = Math.max(0.1, workspaceSettings.grid.sizeY);
        const rad = workspaceSettings.grid.angle * Math.PI / 180;
        const p1 = rotatePoint(screenToWorld(0, 0).x, screenToWorld(0, 0).y, -rad);
        const p2 = rotatePoint(screenToWorld(canvas.width, 0).x, screenToWorld(canvas.width, 0).y, -rad);
        const p3 = rotatePoint(screenToWorld(0, canvas.height).x, screenToWorld(0, canvas.height).y, -rad);
        const p4 = rotatePoint(screenToWorld(canvas.width, canvas.height).x, screenToWorld(canvas.width, canvas.height).y, -rad);
        const minX = Math.min(p1.x, p2.x, p3.x, p4.x); const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y); const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
        const startX = Math.floor(minX / gx) * gx; const endX = Math.ceil(maxX / gx) * gx;
        const startY = Math.floor(minY / gy) * gy; const endY = Math.ceil(maxY / gy) * gy;
        
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gx) {
            const s1 = worldToScreen(rotatePoint(x, startY, rad).x, rotatePoint(x, startY, rad).y);
            const s2 = worldToScreen(rotatePoint(x, endY, rad).x, rotatePoint(x, endY, rad).y);
            ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
        }
        for (let y = startY; y <= endY; y += gy) {
            const s1 = worldToScreen(rotatePoint(startX, y, rad).x, rotatePoint(startX, y, rad).y);
            const s2 = worldToScreen(rotatePoint(endX, y, rad).x, rotatePoint(endX, y, rad).y);
            ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
        }
        ctx.stroke();
    }
}

function draw() {
    // 1. Draw Background
    ctx.fillStyle = workspaceSettings.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. Draw Pages (Background, Border, Margins, Footer)
    pages.forEach((p, idx) => {
        const dim = getPageWorldDimensions(p);
        const tl = getPageTopLeft(p);
        const sptl = worldToScreen(tl.x, tl.y);
        const spw = dim.w * scale;
        const sph = dim.h * scale;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sptl.x + 5, sptl.y + 5, spw, sph);
        
        // Paper BG
        if (p.showBg) {
            ctx.fillStyle = p.bgColor;
            ctx.fillRect(sptl.x, sptl.y, spw, sph);
        }
        
        // Paper Border
        if (p.showBorder) {
            ctx.strokeStyle = p.borderColor || '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(sptl.x, sptl.y, spw, sph);
        }
        
        // 2. Margins and Footer
        let mu = 1;
        if (documentSettings.units === 'cm') mu = 0.1;
        if (documentSettings.units === 'm') mu = 0.001;

        const mt = (p.margins.t.val * mu * p.scale) * scale;
        const mb = (p.margins.b.val * mu * p.scale) * scale;
        const ml = (p.margins.l.val * mu * p.scale) * scale;
        const mr = (p.margins.r.val * mu * p.scale) * scale;

        ctx.strokeStyle = p.borderColor || '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        if (p.margins.t.show) { ctx.beginPath(); ctx.moveTo(sptl.x + ml, sptl.y + mt); ctx.lineTo(sptl.x + spw - mr, sptl.y + mt); ctx.stroke(); }
        if (p.margins.b.show) { ctx.beginPath(); ctx.moveTo(sptl.x + ml, sptl.y + sph - mb); ctx.lineTo(sptl.x + spw - mr, sptl.y + sph - mb); ctx.stroke(); }
        if (p.margins.l.show) { ctx.beginPath(); ctx.moveTo(sptl.x + ml, sptl.y + mt); ctx.lineTo(sptl.x + ml, sptl.y + sph - mb); ctx.stroke(); }
        if (p.margins.r.show) { ctx.beginPath(); ctx.moveTo(sptl.x + spw - mr, sptl.y + mt); ctx.lineTo(sptl.x + spw - mr, sptl.y + sph - mb); ctx.stroke(); }

        // Footer Text
        ctx.fillStyle = '#000000';
        const mmToScreen = 1 * mu * p.scale * scale;
        ctx.font = `${5 * mmToScreen}px Inter`;
        const footerY = sptl.y + sph - mb + (1 * mmToScreen);
        
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left'; ctx.fillText(parseVars(p.footL, p), sptl.x + ml, footerY);
        ctx.textAlign = 'center'; ctx.fillText(parseVars(p.footC, p), sptl.x + spw / 2, footerY);
        ctx.textAlign = 'right'; ctx.fillText(parseVars(p.footR, p), sptl.x + spw - mr, footerY);
        ctx.textBaseline = 'alphabetic';
    });

    // 3. Draw Grid
    drawGrid();

    // ORACLE GHOSTS
    if (isOracleActive && timeMap.activeNodeId) {
        const futures = getFuturePaths(timeMap.activeNodeId);
        futures.secondaryLeafIds.forEach(id => {
            const hue = timeMap.nodes[id].hue || 200;
            renderStateElements(timeMap.nodes[id].state, `hsla(${hue}, 70%, 50%, 0.15)`);
        });
        if (futures.primaryLeafId) {
            const hue = timeMap.nodes[futures.primaryLeafId].hue || 200;
            renderStateElements(timeMap.nodes[futures.primaryLeafId].state, `hsla(${hue}, 90%, 60%, 0.3)`);
        }
    }

    
    // 4. Draw Polylines
    for (let i = 0; i < polylines.length; i++) {
        const pl = polylines[i];
        const layerData = layers[pl.layer];
        if (!layerData || !layerData.visible) continue;
        const isSelected = selectedObjects.some(o => o.type === 'polyline' && o.plIndex === i) || 
                           (currentTool === 'move' && moveSelection.some(s => s.type === 'polyline' && s.index === i)) ||
                           (currentTool === 'rotate' && rotateSelection.some(s => s.type === 'polyline' && s.index === i));
        let selColor = '#4a90e2';
        if (currentTool === 'move') selColor = '#ffa500';
        else if (currentTool === 'rotate') selColor = '#ff00ff';
        ctx.strokeStyle = isSelected ? selColor : layerData.color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        if (pl.points.length > 0) {
            const sp0 = worldToScreen(pl.points[0].x, pl.points[0].y);
            ctx.moveTo(sp0.x, sp0.y);
            for (let j = 0; j < pl.points.length; j++) {
                let nextIdx = j + 1;
                if (nextIdx === pl.points.length) {
                    if (pl.closed && pl.points.length > 2) nextIdx = 0;
                    else continue;
                }
                const p1 = pl.points[j];
                const p2 = pl.points[nextIdx];
                if (p1.bulge && p1.bulge !== 0) {
                    const arc = getArcParams(p1, p2, p1.bulge);
                    if (arc) {
                        const scx = worldToScreen(arc.cx, arc.cy);
                        ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
                    } else {
                        const sp2 = worldToScreen(p2.x, p2.y);
                        ctx.lineTo(sp2.x, sp2.y);
                    }
                } else {
                    const sp2 = worldToScreen(p2.x, p2.y);
                    ctx.lineTo(sp2.x, sp2.y);
                }
            }
        }
        ctx.stroke();
    }
    
    // 5. Draw Labels
    for (let i = 0; i < labels.length; i++) {
        const lbl = labels[i]; const layerData = layers[lbl.layer] || layers['0'];
        if (!layerData.visible) continue;
        const segData = getSegmentData(lbl.plIndex, lbl.segmentIndex); if (!segData) continue;
        const midX = segData.midX; const midY = segData.midY;
        const sp = worldToScreen(midX, midY);
        let prec = lbl.precision !== undefined ? lbl.precision : (documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2);
        let text = lbl.text.replace('#longitud#', segData.len.toFixed(prec)); text = text.replace('#capa#', segData.layer);
        const sp1 = worldToScreen(segData.p1.x, segData.p1.y); const sp2 = worldToScreen(segData.p2.x, segData.p2.y);
        let angle = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x);
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(angle);
        ctx.font = '14px Inter'; const metrics = ctx.measureText(text);
        const isSelected = selectedObjects.some(o => o.type === 'label' && o.index === i) ||
                           (currentTool === 'move' && moveSelection.some(s => s.type === 'label' && s.index === i)) ||
                           (currentTool === 'rotate' && rotateSelection.some(s => s.type === 'label' && s.index === i));
        if (isSelected) {
            let bgCol = 'rgba(74, 144, 226, 0.3)';
            if (currentTool === 'move') bgCol = 'rgba(255, 165, 0, 0.3)';
            else if (currentTool === 'rotate') bgCol = 'rgba(255, 0, 255, 0.3)';
            ctx.fillStyle = bgCol;
            ctx.fillRect(-metrics.width/2 - 4, - 12 - 4 - 5, metrics.width + 8, 20);
        }
        ctx.fillStyle = layerData.color; ctx.textAlign = 'center'; ctx.fillText(text, 0, -5);
        ctx.restore();
    }

    // 5. Draw Currently drawing polyline
    if (currentTool === 'polyline' && currentPolyline && currentPolyline.points.length > 0) {
        const layerData = layers[currentLayer];
        ctx.strokeStyle = layerData ? layerData.color : '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath();
        const sp0 = worldToScreen(currentPolyline.points[0].x, currentPolyline.points[0].y);
        ctx.moveTo(sp0.x, sp0.y);
        for (let i = 0; i < currentPolyline.points.length - 1; i++) {
            const p1 = currentPolyline.points[i];
            const p2 = currentPolyline.points[i+1];
            if (p1.bulge && p1.bulge !== 0) {
                const arc = getArcParams(p1, p2, p1.bulge);
                if (arc) {
                    const scx = worldToScreen(arc.cx, arc.cy);
                    ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
                } else {
                    const sp2 = worldToScreen(p2.x, p2.y);
                    ctx.lineTo(sp2.x, sp2.y);
                }
            } else {
                const sp2 = worldToScreen(p2.x, p2.y);
                ctx.lineTo(sp2.x, sp2.y);
            }
        }
        
        const lastPoint = currentPolyline.points[currentPolyline.points.length - 1];
        
        // Calculate tangent bulge
        if (polylineMode === 'arc') {
            let startDirAngle = 0;
            if (currentPolyline.points.length >= 2) {
                const prevPoint = currentPolyline.points[currentPolyline.points.length - 2];
                if (prevPoint.bulge) {
                    const params = getArcParams(prevPoint, lastPoint, prevPoint.bulge);
                    if (params) {
                        const radAngle = Math.atan2(lastPoint.y - params.cy, lastPoint.x - params.cx);
                        startDirAngle = params.ccw ? radAngle + Math.PI/2 : radAngle - Math.PI/2;
                    } else {
                        startDirAngle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
                    }
                } else {
                    startDirAngle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
                }
            } else {
                startDirAngle = 0;
            }
            
            const chordAngle = Math.atan2(worldY - lastPoint.y, worldX - lastPoint.x);
            let theta = chordAngle - startDirAngle;
            while(theta < -Math.PI) theta += 2*Math.PI;
            while(theta > Math.PI) theta -= 2*Math.PI;
            currentPreviewBulge = Math.tan(theta / 2);
        } else {
            currentPreviewBulge = 0;
        }

        if (currentPreviewBulge !== 0) {
            const arc = getArcParams(lastPoint, {x: worldX, y: worldY}, currentPreviewBulge);
            if (arc) {
                const scx = worldToScreen(arc.cx, arc.cy);
                ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
            } else {
                const cursorPos = worldToScreen(worldX, worldY); ctx.lineTo(cursorPos.x, cursorPos.y);
            }
        } else {
            const cursorPos = worldToScreen(worldX, worldY); ctx.lineTo(cursorPos.x, cursorPos.y);
        }
        ctx.stroke();
        
        const lastPointSp = worldToScreen(lastPoint.x, lastPoint.y);
        const cursorPos = worldToScreen(worldX, worldY);
        const dx = worldX - lastPoint.x; const dy = worldY - lastPoint.y; const length = Math.hypot(dx, dy);
        ctx.font = '12px Inter'; const midX = (lastPointSp.x + cursorPos.x) / 2; const midY = (lastPointSp.y + cursorPos.y) / 2;
        const text = length.toFixed(2); const textMetrics = ctx.measureText(text);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(midX + 6, midY - 20, textMetrics.width + 8, 16);
        ctx.fillStyle = '#4a90e2'; ctx.textAlign = 'left'; ctx.fillText(text, midX + 10, midY - 8);
    }
    
    // Move Tool Preview
    if (currentTool === 'move' && (moveState === 'DESTINATION' || moveState === 'ADJUSTING')) {
        let V = { x: 0, y: 0 };
        if (moveState === 'DESTINATION') V = { x: worldX - moveOrigin.x, y: worldY - moveOrigin.y };
        else V = { x: moveDest.x - moveOrigin.x, y: moveDest.y - moveOrigin.y };
        
        let numCopies = 1;
        let vectorOffset = { x: V.x, y: V.y };
        let mode = 'normal';

        if (moveState === 'ADJUSTING') {
            if (moveModifier.startsWith('/')) {
                const n = parseInt(moveModifier.substring(1));
                if (!isNaN(n) && n > 0) { numCopies = n; vectorOffset = { x: V.x / n, y: V.y / n }; mode = 'divide'; }
            } else if (moveModifier.startsWith('*')) {
                const n = parseInt(moveModifier.substring(1));
                if (!isNaN(n) && n > 0) { numCopies = n; mode = 'multiply'; }
            } else {
                const d = parseFloat(moveModifier);
                if (!isNaN(d)) {
                    const currentLen = Math.hypot(V.x, V.y);
                    if (currentLen > 0) { vectorOffset = { x: V.x / currentLen * d, y: V.y / currentLen * d }; }
                }
            }
        }
        if (isCopyMode && mode === 'normal') numCopies = 1;
        else if (!isCopyMode && mode === 'normal') numCopies = 1;

        moveSelection.forEach(sel => {
            if (sel.type === 'polyline') {
                const pl = polylines[sel.index];
                ctx.strokeStyle = isCopyMode ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)';
                ctx.lineWidth = 2;
                
                let startI = (!isCopyMode && mode === 'normal') ? 1 : 1;
                
                for (let i = startI; i <= numCopies; i++) {
                    const offset = { x: vectorOffset.x * i, y: vectorOffset.y * i };
                    ctx.beginPath();
                    if (pl.points.length > 0) {
                        const sp0 = worldToScreen(pl.points[0].x + offset.x, pl.points[0].y + offset.y);
                        ctx.moveTo(sp0.x, sp0.y);
                        for (let k = 0; k < pl.points.length; k++) {
                            let nextIdx = k + 1;
                            if (nextIdx === pl.points.length) {
                                if (pl.closed && pl.points.length > 2) nextIdx = 0;
                                else continue;
                            }
                            const p1 = { x: pl.points[k].x + offset.x, y: pl.points[k].y + offset.y, bulge: pl.points[k].bulge };
                            const p2 = { x: pl.points[nextIdx].x + offset.x, y: pl.points[nextIdx].y + offset.y, bulge: pl.points[nextIdx].bulge };
                            if (p1.bulge && p1.bulge !== 0) {
                                const arc = getArcParams(p1, p2, p1.bulge);
                                if (arc) {
                                    const scx = worldToScreen(arc.cx, arc.cy);
                                    ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
                                } else {
                                    const sp2 = worldToScreen(p2.x, p2.y);
                                    ctx.lineTo(sp2.x, sp2.y);
                                }
                            } else {
                                const sp2 = worldToScreen(p2.x, p2.y);
                                ctx.lineTo(sp2.x, sp2.y);
                            }
                        }
                    }
                    ctx.stroke();
                }
            }
        });
        
        // Draw distance tag
        const dist = Math.hypot(vectorOffset.x, vectorOffset.y);
        ctx.font = '12px Inter'; const text = "d: " + dist.toFixed(2) + (isCopyMode ? " (Copy)" : " (Move)") + (moveModifier ? " ["+moveModifier+"]" : "");
        const textMetrics = ctx.measureText(text);
        const spOrigin = worldToScreen(moveOrigin.x, moveOrigin.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(spOrigin.x + 10, spOrigin.y - 20, textMetrics.width + 8, 16);
        ctx.fillStyle = isCopyMode ? '#00ff00' : '#ffa500'; ctx.textAlign = 'left'; ctx.fillText(text, spOrigin.x + 14, spOrigin.y - 8);
    }
    
    // Rotate Tool Preview
    if (currentTool === 'rotate' && rotateState === 'REFERENCE' && rotateOrigin) {
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const spOrigin = worldToScreen(rotateOrigin.x, rotateOrigin.y);
        const cursorPos = worldToScreen(worldX, worldY);
        ctx.moveTo(spOrigin.x, spOrigin.y); ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.stroke(); ctx.setLineDash([]);
        
        ctx.font = '12px Inter'; const text = "Referencia";
        const textMetrics = ctx.measureText(text);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(cursorPos.x + 10, cursorPos.y - 20, textMetrics.width + 8, 16);
        ctx.fillStyle = '#ff00ff'; ctx.textAlign = 'left'; ctx.fillText(text, cursorPos.x + 14, cursorPos.y - 8);
    }

    if (currentTool === 'rotate' && (rotateState === 'ANGLE' || rotateState === 'ADJUSTING') && rotateOrigin) {
        let currentTargetX = worldX;
        let currentTargetY = worldY;
        if (rotateState === 'ADJUSTING' && rotateTargetPoint) {
            currentTargetX = rotateTargetPoint.x;
            currentTargetY = rotateTargetPoint.y;
        }
        const targetAngle = Math.atan2(currentTargetY - rotateOrigin.y, currentTargetX - rotateOrigin.x);
        let refAngle = 0;
        if (rotateReference) {
            refAngle = Math.atan2(rotateReference.y - rotateOrigin.y, rotateReference.x - rotateOrigin.x);
        }
        let rad = targetAngle - refAngle;
        while (rad > Math.PI) rad -= 2 * Math.PI;
        while (rad <= -Math.PI) rad += 2 * Math.PI;
        let numCopies = 1;
        let angleOffset = rad;
        let mode = 'normal';

        if (rotateModifier.startsWith('/')) {
            const n = parseInt(rotateModifier.substring(1));
            if (!isNaN(n) && n > 0) { numCopies = n; angleOffset = rad / n; mode = 'divide'; }
        } else if (rotateModifier.startsWith('*')) {
            const n = parseInt(rotateModifier.substring(1));
            if (!isNaN(n) && n > 0) { numCopies = n; mode = 'multiply'; }
        }
        
        if (isCopyMode && mode === 'normal') numCopies = 1;
        else if (!isCopyMode && mode === 'normal') numCopies = 1;
        
        rotateSelection.forEach(sel => {
            if (sel.type === 'polyline') {
                const pl = polylines[sel.index];
                ctx.strokeStyle = isCopyMode ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 0, 255, 0.5)';
                ctx.lineWidth = 2;
                
                let startI = (!isCopyMode && mode === 'normal') ? 1 : 1;
                
                for (let i = startI; i <= numCopies; i++) {
                    const currentAngle = (mode === 'divide') ? (angleOffset * i) : (angleOffset * i);
                    ctx.beginPath();
                    if (pl.points.length > 0) {
                        const rp0 = rotatePoint(pl.points[0].x, pl.points[0].y, currentAngle, rotateOrigin.x, rotateOrigin.y);
                        const sp0 = worldToScreen(rp0.x, rp0.y);
                        ctx.moveTo(sp0.x, sp0.y);
                        for (let k = 0; k < pl.points.length; k++) {
                            let nextIdx = k + 1;
                            if (nextIdx === pl.points.length) {
                                if (pl.closed && pl.points.length > 2) nextIdx = 0;
                                else continue;
                            }
                            
                            const rpk = rotatePoint(pl.points[k].x, pl.points[k].y, currentAngle, rotateOrigin.x, rotateOrigin.y);
                            const rpnext = rotatePoint(pl.points[nextIdx].x, pl.points[nextIdx].y, currentAngle, rotateOrigin.x, rotateOrigin.y);
                            
                            const p1 = { x: rpk.x, y: rpk.y, bulge: pl.points[k].bulge };
                            const p2 = { x: rpnext.x, y: rpnext.y, bulge: pl.points[nextIdx].bulge };
                            if (p1.bulge && p1.bulge !== 0) {
                                const arc = getArcParams(p1, p2, p1.bulge);
                                if (arc) {
                                    const scx = worldToScreen(arc.cx, arc.cy);
                                    ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
                                } else {
                                    const sp2 = worldToScreen(p2.x, p2.y);
                                    ctx.lineTo(sp2.x, sp2.y);
                                }
                            } else {
                                const sp2 = worldToScreen(p2.x, p2.y);
                                ctx.lineTo(sp2.x, sp2.y);
                            }
                        }
                    }
                    ctx.stroke();
                }
            }
        });
        
        // Draw angle tag and origin
        const deg = (rad * 180 / Math.PI);
        ctx.font = '12px Inter'; const text = "ang: " + deg.toFixed(2) + "°" + (isCopyMode ? " (Copy)" : " (Rot)") + (rotateModifier ? " ["+rotateModifier+"]" : "");
        const textMetrics = ctx.measureText(text);
        const spOrigin = worldToScreen(rotateOrigin.x, rotateOrigin.y);
        const cursorPos = worldToScreen(worldX, worldY);
        
        // draw origin cross
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(spOrigin.x - 5, spOrigin.y); ctx.lineTo(spOrigin.x + 5, spOrigin.y);
        ctx.moveTo(spOrigin.x, spOrigin.y - 5); ctx.lineTo(spOrigin.x, spOrigin.y + 5); ctx.stroke();
        
        // draw reference and target line
        if (rotateReference) {
            ctx.setLineDash([5, 5]);
            const rp = rotatePoint(rotateReference.x, rotateReference.y, rad, rotateOrigin.x, rotateOrigin.y);
            const spRef = worldToScreen(rp.x, rp.y);
            ctx.beginPath(); ctx.moveTo(spOrigin.x, spOrigin.y); ctx.lineTo(spRef.x, spRef.y); ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(cursorPos.x + 10, cursorPos.y - 20, textMetrics.width + 8, 16);
        ctx.fillStyle = isCopyMode ? '#00ffff' : '#ff00ff'; ctx.textAlign = 'left'; ctx.fillText(text, cursorPos.x + 14, cursorPos.y - 8);
    }
    
    // 6. Draw Grips if selected
    if (selectedObjects.some(o => o.type === 'polyline')) {
        const pl = polylines[(selectedObjects.find(o => o.type === 'polyline') || {}).plIndex];
        const gripSize = 8;
        for (let j = 0; j < pl.points.length; j++) {
            ctx.fillStyle = '#4a90e2';
            const sp = worldToScreen(pl.points[j].x, pl.points[j].y);
            ctx.fillRect(sp.x - gripSize/2, sp.y - gripSize/2, gripSize, gripSize);
            
            let nextIdx = j + 1;
            if (nextIdx === pl.points.length) {
                if (pl.closed && pl.points.length > 2) nextIdx = 0;
                else continue;
            }
            const p1 = pl.points[j]; const p2 = pl.points[nextIdx];
            let midSp;
            if (p1.bulge && p1.bulge !== 0) {
                const params = getArcParams(p1, p2, p1.bulge);
                if (params) {
                    const midW = getArcMidpoint(params);
                    midSp = worldToScreen(midW.x, midW.y);
                } else {
                    midSp = worldToScreen((p1.x + p2.x)/2, (p1.y + p2.y)/2);
                }
            } else {
                midSp = worldToScreen((p1.x + p2.x)/2, (p1.y + p2.y)/2);
            }
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(midSp.x - gripSize/2, midSp.y - gripSize/2, gripSize, gripSize);
        }
    }
    
    // 7. Draw Snapping
    if (snapPoint && typedLength === '') {
        const sp = worldToScreen(snapPoint.x, snapPoint.y);
        ctx.strokeStyle = snapPoint.type === 'grid' ? workspaceSettings.grid.color : '#00ff00'; 
        ctx.lineWidth = 2;
        const size = 10;
        ctx.beginPath();
        if (snapPoint.type === 'endpoint') {
            ctx.strokeRect(sp.x - size/2, sp.y - size/2, size, size);
        } else if (snapPoint.type === 'midpoint') {
            ctx.moveTo(sp.x, sp.y - size/2);
            ctx.lineTo(sp.x + size/2, sp.y + size/2);
            ctx.lineTo(sp.x - size/2, sp.y + size/2);
            ctx.closePath();
            ctx.stroke();
        } else if (snapPoint.type === 'center') {
            ctx.arc(sp.x, sp.y, size/2, 0, Math.PI*2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sp.x - size/2 - 2, sp.y); ctx.lineTo(sp.x + size/2 + 2, sp.y);
            ctx.moveTo(sp.x, sp.y - size/2 - 2); ctx.lineTo(sp.x, sp.y + size/2 + 2);
            ctx.stroke();
        } else if (snapPoint.type === 'perpendicular') {
            ctx.moveTo(sp.x - size/2, sp.y - size/2);
            ctx.lineTo(sp.x - size/2, sp.y + size/2);
            ctx.lineTo(sp.x + size/2, sp.y + size/2);
            ctx.stroke();
        } else if (snapPoint.type === 'extension') {
            ctx.moveTo(sp.x - size/2, sp.y - size/2);
            ctx.lineTo(sp.x + size/2, sp.y + size/2);
            ctx.moveTo(sp.x + size/2, sp.y - size/2);
            ctx.lineTo(sp.x - size/2, sp.y + size/2);
            ctx.stroke();
            
            if (snapPoint.data) {
                const sp1 = worldToScreen(snapPoint.data.p1.x, snapPoint.data.p1.y);
                const sp2 = worldToScreen(snapPoint.data.p2.x, snapPoint.data.p2.y);
                const d1 = Math.hypot(sp.x - sp1.x, sp.y - sp1.y);
                const d2 = Math.hypot(sp.x - sp2.x, sp.y - sp2.y);
                const spTarget = d1 < d2 ? sp1 : sp2;
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([4, 4]);
                ctx.moveTo(sp.x, sp.y);
                ctx.lineTo(spTarget.x, spTarget.y);
                ctx.stroke();
                ctx.restore();
            }
        } else if (snapPoint.type === 'intersection' || snapPoint.type === 'grid') {
            ctx.moveTo(sp.x - size/2, sp.y - size/2);
            ctx.lineTo(sp.x + size/2, sp.y + size/2);
            ctx.moveTo(sp.x + size/2, sp.y - size/2);
            ctx.lineTo(sp.x - size/2, sp.y + size/2);
            ctx.stroke();
        } else {
            ctx.strokeRect(sp.x - size/2, sp.y - size/2, size, size);
        }
    }
    
    // 7. Draw Crosshair
    if (currentTool === 'polyline') {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; ctx.lineWidth = 1; const sp = worldToScreen(worldX, worldY);
        ctx.beginPath(); ctx.moveTo(sp.x, 0); ctx.lineTo(sp.x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(canvas.width, sp.y); ctx.stroke();
    }
    
    // 8. Draw Page UI Controls (Anchors and Icons) always on top!
    pages.forEach((p, idx) => {
        const spAnchor = worldToScreen(p.x, p.y);
        ctx.fillStyle = (selectedObjects.some(o => o.type === 'page' && o.index === idx)) ? '#ff4444' : '#4a90e2';
        ctx.beginPath();
        ctx.arc(spAnchor.x, spAnchor.y, 4, 0, Math.PI*2);
        ctx.fill();
        
        if (currentTool === 'select') {
            ctx.strokeStyle = (selectedObjects.some(o => o.type === 'page' && o.index === idx)) ? '#ff4444' : '#4a90e2';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = p.bgColor ? p.bgColor : '#ffffff'; // Fallback to white if no bg
            ctx.beginPath();
            ctx.moveTo(spAnchor.x - 8, spAnchor.y - 8);
            ctx.lineTo(spAnchor.x - 8, spAnchor.y - 24);
            ctx.lineTo(spAnchor.x + 2, spAnchor.y - 24);
            ctx.lineTo(spAnchor.x + 8, spAnchor.y - 18);
            ctx.lineTo(spAnchor.x + 8, spAnchor.y - 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(spAnchor.x + 2, spAnchor.y - 24);
            ctx.lineTo(spAnchor.x + 2, spAnchor.y - 18);
            ctx.lineTo(spAnchor.x + 8, spAnchor.y - 18);
            ctx.stroke();
        }
    });
}

// PDF Generation
async function generatePDF() {
    if (typeof window.jspdf === 'undefined') {
        alert("La librería PDF aún no ha cargado. Intenta de nuevo en unos segundos.");
        return;
    }
    const { jsPDF } = window.jspdf;
    
    const selOpt = document.getElementById('print-selection').value;
    const isColor = document.getElementById('print-color').value === 'color';
    const isMultiple = document.getElementById('print-mode').value === 'multiple';
    const namePattern = document.getElementById('print-filename').value;
    
    const selPageObj = selectedObjects.find(o => o.type === 'page');
    const selectedPageIdx = selPageObj ? selPageObj.index : -1;

    let pagesToPrint = [];
    if (selOpt === 'all') {
        pagesToPrint = pages;
    } else if (selOpt === 'selected') {
        if (selectedPageIdx >= 0 && pages[selectedPageIdx]) {
            pagesToPrint = [pages[selectedPageIdx]];
        } else if (pages.length > 0) {
            pagesToPrint = [pages[0]];
        }
    } else {
        const idx = parseInt(selOpt);
        if (!isNaN(idx) && pages[idx]) {
            pagesToPrint = [pages[idx]];
        }
    }
    
    if (pagesToPrint.length === 0) {
        alert("No hay páginas para imprimir.");
        return;
    }
    
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    
    let pdf = null;
    const DPI_SCALE = 4;
    
    for (let i = 0; i < pagesToPrint.length; i++) {
        const p = pagesToPrint[i];
        const formats = { 'A4': [210, 297], 'A3': [297, 420], 'A2': [420, 594], 'A1': [594, 841], 'A0': [841, 1189] };
        const fmt = formats[p.format] || formats['A4'];
        let w_mm = fmt[0];
        let h_mm = fmt[1];
        let orient = p.orient === 'landscape' ? 'l' : 'p';
        if (orient === 'l') { const t = w_mm; w_mm = h_mm; h_mm = t; }
        
        if (isMultiple || i === 0) {
            pdf = new jsPDF({ orientation: orient, unit: 'mm', format: p.format.toLowerCase() });
        } else {
            pdf.addPage(p.format.toLowerCase(), orient);
        }
        
        offCanvas.width = Math.round(w_mm * DPI_SCALE);
        offCanvas.height = Math.round(h_mm * DPI_SCALE);
        
        const dim = getPageWorldDimensions(p);
        const tl = getPageTopLeft(p);
        const tempScale = offCanvas.width / dim.w;
        const tempPanX = -(tl.x * tempScale);
        const tempPanY = (tl.y * tempScale); 
        
        const offWorldToScreen = (wx, wy) => {
            return { x: (wx * tempScale) + tempPanX, y: (-wy * tempScale) + tempPanY };
        };
        
        // 1. Background & Border
        if (p.showBg) {
            offCtx.fillStyle = p.bgColor || '#ffffff';
            offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        }
        if (p.showBorder) {
            offCtx.strokeStyle = isColor ? (p.borderColor || '#000000') : '#000000';
            offCtx.lineWidth = 2 * DPI_SCALE;
            offCtx.strokeRect(0, 0, offCanvas.width, offCanvas.height);
        }
        
        // 2. Margins and Footer
        let mu = 1;
        if (documentSettings.units === 'cm') mu = 0.1;
        if (documentSettings.units === 'm') mu = 0.001;
        const mt = (p.margins.t.val * mu * p.scale) * tempScale;
        const mb = (p.margins.b.val * mu * p.scale) * tempScale;
        const ml = (p.margins.l.val * mu * p.scale) * tempScale;
        const mr = (p.margins.r.val * mu * p.scale) * tempScale;
        const spw = offCanvas.width;
        const sph = offCanvas.height;

        offCtx.strokeStyle = isColor ? (p.borderColor || '#000000') : '#000000';
        offCtx.lineWidth = 1 * DPI_SCALE;
        offCtx.setLineDash([]);
        if (p.margins.t.show) { offCtx.beginPath(); offCtx.moveTo(ml, mt); offCtx.lineTo(spw - mr, mt); offCtx.stroke(); }
        if (p.margins.b.show) { offCtx.beginPath(); offCtx.moveTo(ml, sph - mb); offCtx.lineTo(spw - mr, sph - mb); offCtx.stroke(); }
        if (p.margins.l.show) { offCtx.beginPath(); offCtx.moveTo(ml, mt); offCtx.lineTo(ml, sph - mb); offCtx.stroke(); }
        if (p.margins.r.show) { offCtx.beginPath(); offCtx.moveTo(spw - mr, mt); offCtx.lineTo(spw - mr, sph - mb); offCtx.stroke(); }
        
        offCtx.fillStyle = '#000000';
        const mmToScreen = 1 * mu * p.scale * tempScale;
        offCtx.font = `${5 * mmToScreen}px Inter`;
        const footerY = sph - mb + (1 * mmToScreen);
        
        offCtx.textBaseline = 'top';
        offCtx.textAlign = 'left'; offCtx.fillText(parseVars(p.footL, p), ml, footerY);
        offCtx.textAlign = 'center'; offCtx.fillText(parseVars(p.footC, p), spw/2, footerY);
        offCtx.textAlign = 'right'; offCtx.fillText(parseVars(p.footR, p), spw - mr, footerY);
        offCtx.textBaseline = 'alphabetic';

        // 3. Geometry (Polylines)
        for (let j = 0; j < polylines.length; j++) {
            const pl = polylines[j];
            const layerData = layers[pl.layer];
            if (!layerData || !layerData.visible) continue;
            
            offCtx.strokeStyle = isColor ? layerData.color : '#000000';
            offCtx.lineWidth = 1 * DPI_SCALE / 2;
            offCtx.beginPath();
            if (pl.points.length > 0) {
                const sp0 = offWorldToScreen(pl.points[0].x, pl.points[0].y);
                offCtx.moveTo(sp0.x, sp0.y);
                for (let k = 0; k < pl.points.length; k++) {
                    let nextIdx = k + 1;
                    if (nextIdx === pl.points.length) {
                        if (pl.closed && pl.points.length > 2) nextIdx = 0;
                        else continue;
                    }
                    const p1 = pl.points[k];
                    const p2 = pl.points[nextIdx];
                    if (p1.bulge && p1.bulge !== 0) {
                        const arc = getArcParams(p1, p2, p1.bulge);
                        if (arc) {
                            const scx = offWorldToScreen(arc.cx, arc.cy);
                            offCtx.arc(scx.x, scx.y, arc.R * tempScale, -arc.startAngle, -arc.endAngle, arc.ccw);
                        } else {
                            const sp2 = offWorldToScreen(p2.x, p2.y);
                            offCtx.lineTo(sp2.x, sp2.y);
                        }
                    } else {
                        const sp2 = offWorldToScreen(p2.x, p2.y);
                        offCtx.lineTo(sp2.x, sp2.y);
                    }
                }
            }
            if (pl.closed && pl.points.length > 2) offCtx.closePath();
            offCtx.stroke();
        }
        
        // 4. Geometry (Labels)
        for (let j = 0; j < labels.length; j++) {
            const lbl = labels[j];
            const layerData = layers[lbl.layer || '0'];
            if (!layerData || !layerData.visible) continue;
            const segData = getSegmentData(lbl.plIndex, lbl.segmentIndex); if (!segData) continue;
            const midX = segData.midX; const midY = segData.midY;
            const sp = offWorldToScreen(midX, midY);
            let prec = lbl.precision !== undefined ? lbl.precision : (documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2);
            let text = lbl.text.replace('#longitud#', segData.len.toFixed(prec)).replace('#capa#', segData.layer);
            const sp1 = offWorldToScreen(segData.p1.x, segData.p1.y); const sp2 = offWorldToScreen(segData.p2.x, segData.p2.y);
            let angle = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x);
            if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
            offCtx.save(); offCtx.translate(sp.x, sp.y); offCtx.rotate(angle);
            
            const printSizeMm = lbl.printSize || 5;
            const fontSizeScreen = printSizeMm * mu * p.scale * tempScale;
            offCtx.font = `${fontSizeScreen}px Inter`;
            
            offCtx.fillStyle = isColor ? layerData.color : '#000000';
            offCtx.textAlign = 'center'; offCtx.fillText(text, 0, -5 * DPI_SCALE);
            offCtx.restore();
        }
        
        // Add to PDF
        const imgData = offCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', 0, 0, w_mm, h_mm);
        
        if (isMultiple) {
            let fname = parseVars(namePattern, p);
            if (!fname || fname.trim() === '') fname = p.name;
            pdf.save(fname + ".pdf");
        }
    }
    
    if (!isMultiple) {
        let fname = parseVars(namePattern, pagesToPrint[0]);
        if (!fname || fname.trim() === '') {
            fname = (documentSettings.fileName || 'Dibujo') + '_Plano';
        }
        pdf.save(fname + ".pdf");
    }
}

function commitRotate(worldX, worldY, fixedAngle = null) {
    if (rotateSelection.length === 0 || !rotateOrigin) {
        rotateState = 'SELECTING'; rotateSelection = []; rotateModifier = ''; draw(); return;
    }
    
    let rad = 0;
    if (fixedAngle !== null) {
        rad = fixedAngle * Math.PI / 180;
    } else {
        const targetAngle = Math.atan2(worldY - rotateOrigin.y, worldX - rotateOrigin.x);
        let refAngle = 0;
        if (rotateReference) {
            refAngle = Math.atan2(rotateReference.y - rotateOrigin.y, rotateReference.x - rotateOrigin.x);
        }
        rad = targetAngle - refAngle;
        while (rad > Math.PI) rad -= 2 * Math.PI;
        while (rad <= -Math.PI) rad += 2 * Math.PI;
    }
    
    let numCopies = 1;
    let angleOffset = rad;
    let mode = 'normal';

    if (rotateModifier.startsWith('/')) {
        const n = parseInt(rotateModifier.substring(1));
        if (!isNaN(n) && n > 0) { numCopies = n; angleOffset = rad / n; mode = 'divide'; }
    } else if (rotateModifier.startsWith('*')) {
        const n = parseInt(rotateModifier.substring(1));
        if (!isNaN(n) && n > 0) { numCopies = n; mode = 'multiply'; }
    }
    
    for (let c = 1; c <= numCopies; c++) {
        let currentAngle = (mode === 'divide') ? (angleOffset * c) : (angleOffset * c);
        
        rotateSelection.forEach(item => {
            if (item.type === 'polyline') {
                const pl = polylines[item.index];
                const newPts = pl.points.map(p => {
                    const rot = rotatePoint(p.x, p.y, currentAngle, rotateOrigin.x, rotateOrigin.y);
                    return { x: rot.x, y: rot.y, bulge: p.bulge };
                });
                if (isCopyMode) polylines.push({ layer: pl.layer, closed: pl.closed, points: newPts });
                else pl.points = newPts;
            } else if (item.type === 'label') {
                const lbl = labels[item.index];
                if (isCopyMode) labels.push({ text: lbl.text, plIndex: (isCopyMode && item.type==='polyline') ? polylines.length-1 : lbl.plIndex, segmentIndex: lbl.segmentIndex, layer: lbl.layer });
            }
        });
    }
    
    const isCopy = isCopyMode;
    rotateState = 'SELECTING'; rotateSelection = []; rotateOrigin = null; rotateReference = null; rotateModifier = ''; rotateCommandInput = ''; isCopyMode = false;
    commitTimeMap(isCopy ? 'Copiar (Rotación)' : 'Rotar');
    draw();
}

function commitMoveCopy() {
    if (moveSelection.length === 0 || !moveOrigin || !moveDest) {
        moveState = 'SELECTING'; moveSelection = []; moveModifier = ''; draw(); return;
    }

    const V = { x: moveDest.x - moveOrigin.x, y: moveDest.y - moveOrigin.y };
    let numCopies = 1;
    let vectorOffset = { x: V.x, y: V.y };
    let mode = 'normal';

    if (moveModifier.startsWith('/')) {
        const n = parseInt(moveModifier.substring(1));
        if (!isNaN(n) && n > 0) { numCopies = n; vectorOffset = { x: V.x / n, y: V.y / n }; mode = 'divide'; }
    } else if (moveModifier.startsWith('*')) {
        const n = parseInt(moveModifier.substring(1));
        if (!isNaN(n) && n > 0) { numCopies = n; mode = 'multiply'; }
    } else {
        const d = parseFloat(moveModifier);
        if (!isNaN(d)) {
            const currentLen = Math.hypot(V.x, V.y);
            if (currentLen > 0) { vectorOffset = { x: V.x / currentLen * d, y: V.y / currentLen * d }; }
        }
    }
    if (isCopyMode && mode === 'normal') numCopies = 1;
    else if (!isCopyMode && mode === 'normal') numCopies = 1;

    let newPolylines = [];
    
    moveSelection.forEach(sel => {
        if (sel.type === 'polyline') {
            const pl = polylines[sel.index];
            if (!isCopyMode && mode === 'normal') {
                pl.points = pl.points.map(p => ({ ...p, x: p.x + vectorOffset.x, y: p.y + vectorOffset.y }));
            } else {
                for (let i = 1; i <= numCopies; i++) {
                    const offset = { x: vectorOffset.x * i, y: vectorOffset.y * i };
                    newPolylines.push({ layer: pl.layer, closed: pl.closed, points: pl.points.map(p => ({ ...p, x: p.x + offset.x, y: p.y + offset.y })) });
                }
                if (mode === 'divide' || mode === 'multiply') { // Also copy the original to the end position if divide? Wait, if multiply, we just do i=1 to n.
                    // If divide, n copies IN BETWEEN, but the user expects the final one at destination? 
                    // Example: /3 means 2 copies in between, and the one at destination. Let's say numCopies = 3. i=1, 2, 3.
                    // So numCopies = n. i goes from 1 to n.
                }
            }
        }
    });

    if (newPolylines.length > 0) {
        polylines = polylines.concat(newPolylines);
    }
    
    const isCopy = isCopyMode;
    moveState = 'SELECTING';
    moveSelection = [];
    moveOrigin = null;
    moveDest = null;
    moveModifier = '';
    moveCommandInput = '';
    isCopyMode = false;
    document.getElementById('length-input-overlay').style.display = 'none';
    commitTimeMap(isCopy ? 'Copiar' : 'Mover');
    draw();
}

// Initial commit
commitTimeMap('Dibujo inicial');

// Time Map UI Logic
const tmPanel = document.getElementById("time-map-panel");
const tmToggle = document.getElementById("time-map-toggle");
const tmToggleIcon = document.getElementById("time-map-toggle-icon");
const tmSvg = document.getElementById("time-map-svg");
const btnTagNode = document.getElementById("btn-tag-node");
const btnToggleOracle = document.getElementById("btn-toggle-oracle");

let isTmExpanded = false;


if(tmToggle) {
    tmToggle.addEventListener("click", () => {
        isTmExpanded = !isTmExpanded;
        if (isTmExpanded) {
            tmPanel.classList.remove("time-map-collapsed");
            tmPanel.classList.add("time-map-expanded");
            tmToggleIcon.innerHTML = `<polyline points="18 9 12 15 6 9"></polyline>`;
            renderTimeMapSVG();
        } else {
            tmPanel.classList.remove("time-map-expanded");
            tmPanel.classList.add("time-map-collapsed");
            tmToggleIcon.innerHTML = `<polyline points="18 15 12 9 6 15"></polyline>`;
        }
    });
}

if(btnTagNode) {
    btnTagNode.addEventListener("click", () => {
        if (!timeMap.activeNodeId) return;
        const currentTag = timeMap.nodes[timeMap.activeNodeId].tag || "";
        const newTag = prompt("Etiqueta para este momento:", currentTag);
        if (newTag !== null) {
            tagCurrentNode(newTag.trim());
        }
    });
}

if (btnToggleOracle) {
    btnToggleOracle.addEventListener("click", () => {
        isOracleActive = !isOracleActive;
        if (isOracleActive) {
            btnToggleOracle.style.background = "#00bcd4";
            btnToggleOracle.style.color = "#000";
        } else {
            btnToggleOracle.style.background = "#333";
            btnToggleOracle.style.color = "white";
        }
        draw();
        if (window.renderTimeMapSVG) window.renderTimeMapSVG();
    });
}

// Create tooltip div
const tmTooltip = document.createElement("div");
tmTooltip.className = "tm-tooltip";
document.body.appendChild(tmTooltip);

function calculateGraphLayout() {
    const nodes = timeMap.nodes;
    if (Object.keys(nodes).length === 0) return { layouts: {}, maxDepth: 0, maxRow: 0 };

    const trunkIds = new Set();
    let currentId = timeMap.activeNodeId;
    while (currentId) {
        trunkIds.add(currentId);
        currentId = nodes[currentId].parentId;
    }

    const layouts = {}; 
    const depths = {};
    const getDepth = (id) => {
        if (depths[id] !== undefined) return depths[id];
        if (!nodes[id].parentId) {
            depths[id] = 0;
            return 0;
        }
        const d = getDepth(nodes[id].parentId) + 1;
        depths[id] = d;
        return d;
    };
    
    for (let id in nodes) getDepth(id);

    const childrenMap = {};
    for (let id in nodes) childrenMap[id] = [];
    for (let id in nodes) {
        const pid = nodes[id].parentId;
        if (pid && childrenMap[pid]) {
            childrenMap[pid].push({ id: id, ts: nodes[id].timestamp });
        }
    }
    for (let id in childrenMap) {
        childrenMap[id].sort((a, b) => a.ts - b.ts);
    }

    let nextAvailableRow = 1;

    const assignRow = (id, row) => {
        layouts[id] = { depth: depths[id], row: row };
        
        const children = childrenMap[id] || [];
        let trunkChild = null;
        const otherChildren = [];
        
        for (let child of children) {
            if (trunkIds.has(child.id)) {
                trunkChild = child.id;
            } else {
                otherChildren.push(child.id);
            }
        }
        
        if (trunkChild) {
            assignRow(trunkChild, row);
        } else if (otherChildren.length > 0) {
            const cont = otherChildren.pop();
            assignRow(cont, row);
        }
        
        for (let child of otherChildren) {
            assignRow(child, nextAvailableRow++);
        }
    };
    
    for (let id in nodes) {
        if (!nodes[id].parentId) {
            if (trunkIds.has(id)) {
                assignRow(id, 0);
            } else {
                assignRow(id, nextAvailableRow++);
            }
        }
    }

    let maxDepth = 0;
    for (let id in layouts) {
        if (layouts[id].depth > maxDepth) maxDepth = layouts[id].depth;
    }

    return { layouts, maxDepth, maxRow: nextAvailableRow - 1 };
}

window.renderTimeMapSVG = function() {
    if (!isTmExpanded || !tmSvg) return;
    const { layouts, maxDepth, maxRow } = calculateGraphLayout();
    let oracleData = null;
    if (isOracleActive && timeMap.activeNodeId) { oracleData = getFuturePaths(timeMap.activeNodeId); }
    
    const nodeSpacingX = 60;
    const nodeSpacingY = 40;
    const paddingX = 40;
    const paddingY = 40;
    
    const width = Math.max(tmPanel.clientWidth, maxDepth * nodeSpacingX + paddingX * 2);
    const height = Math.max(200, maxRow * nodeSpacingY + paddingY * 2);
    
    tmSvg.setAttribute("width", width);
    tmSvg.setAttribute("height", height);
    
    tmSvg.innerHTML = "";
    
    const nodes = timeMap.nodes;
    for (let id in nodes) {
        const node = nodes[id];
        if (node.parentId && layouts[node.parentId]) {
            const pLayout = layouts[node.parentId];
            const cLayout = layouts[id];
            
            const x1 = paddingX + pLayout.depth * nodeSpacingX;
            const y1 = paddingY + pLayout.row * nodeSpacingY;
            const x2 = paddingX + cLayout.depth * nodeSpacingX;
            const y2 = paddingY + cLayout.row * nodeSpacingY;
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = `M ${x1} ${y1} C ${x1 + nodeSpacingX/2} ${y1}, ${x2 - nodeSpacingX/2} ${y2}, ${x2} ${y2}`;
            path.setAttribute("d", d);
            path.setAttribute("class", "tm-link");
            
            const hue = cLayout.node ? (cLayout.node.hue || 200) : (timeMap.nodes[id].hue || 200);
            if (oracleData && oracleData.activeFutures.has(id)) {
                path.setAttribute("stroke", `hsla(${hue}, 90%, 60%, 0.8)`);
                path.setAttribute("stroke-width", "3");
            } else if (cLayout.row === 0 && pLayout.row === 0) {
                path.setAttribute("stroke", `hsl(${hue}, 70%, 50%)`);
            } else {
                path.setAttribute("stroke", `hsl(${hue}, 30%, 40%)`);
            }
            tmSvg.appendChild(path);
        }
    }
    
    for (let id in nodes) {
        const node = nodes[id];
        const l = layouts[id];
        const cx = paddingX + l.depth * nodeSpacingX;
        const cy = paddingY + l.row * nodeSpacingY;
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", id === timeMap.activeNodeId ? 7 : 5);
        circle.setAttribute("class", "tm-node");
        
        const hue = node.hue || 200;
        circle.setAttribute("stroke", `hsl(${hue}, 70%, 50%)`);
        circle.setAttribute("stroke-width", "2");
        if (oracleData && oracleData.activeFutures.has(id)) {
            circle.setAttribute("stroke-width", "3");
        }

        if (id === timeMap.activeNodeId) {
            circle.setAttribute("fill", "#ffffff");
            circle.setAttribute("stroke-width", "3");
        } else if (node.tag) {
            circle.setAttribute("fill", "#ff9800"); 
        } else {
            circle.setAttribute("fill", "#1a1a1a");
        }
        
        circle.addEventListener("mouseenter", (e) => {
            tmTooltip.style.display = "block";
            let txt = node.message;
            if (node.tag) txt = `[${node.tag}] ${txt}`;
            if (id === timeMap.activeNodeId) txt += " (Actual)";
            tmTooltip.textContent = txt;
            tmTooltip.style.left = (e.pageX + 10) + "px";
            tmTooltip.style.top = (e.pageY + 10) + "px";
        });
        circle.addEventListener("mousemove", (e) => {
            tmTooltip.style.left = (e.pageX + 10) + "px";
            tmTooltip.style.top = (e.pageY + 10) + "px";
        });
        circle.addEventListener("mouseleave", () => {
            tmTooltip.style.display = "none";
        });
        
        circle.addEventListener("click", () => {
            if (id !== timeMap.activeNodeId) {
                checkoutNode(id);
            }
        });
        
        tmSvg.appendChild(circle);
        
        if (node.tag) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", cx);
            text.setAttribute("y", cy - 12);
            text.setAttribute("fill", "#ff9800");
            text.setAttribute("font-size", "10px");
            text.setAttribute("text-anchor", "middle");
            text.textContent = node.tag;
            tmSvg.appendChild(text);
        }
    }
    
    setTimeout(() => {
        const body = document.getElementById("time-map-body");
        if(body) body.scrollLeft = width;
    }, 10);
};



function getFuturePaths(startNodeId) {
    if (!startNodeId || !timeMap.nodes[startNodeId]) return { primaryLeafId: null, secondaryLeafIds: [], activeFutures: new Set() };
    
    let paths = [];
    function dfs(nodeId, currentPath) {
        const node = timeMap.nodes[nodeId];
        currentPath.push(nodeId);
        if (node.childrenIds.length === 0) {
            paths.push([...currentPath]);
        } else {
            node.childrenIds.forEach(childId => dfs(childId, currentPath));
        }
        currentPath.pop();
    }
    
    const startNode = timeMap.nodes[startNodeId];
    if (startNode.childrenIds.length === 0) return { primaryLeafId: null, secondaryLeafIds: [], activeFutures: new Set() };
    
    startNode.childrenIds.forEach(childId => dfs(childId, []));
    paths.sort((a, b) => b.length - a.length);
    
    const activeFutures = new Set();
    paths.forEach(p => p.forEach(id => activeFutures.add(id)));
    
    const primaryLeafId = paths[0][paths[0].length - 1];
    const secondaryLeafIds = [];
    for (let i = 1; i < paths.length; i++) secondaryLeafIds.push(paths[i][paths[i].length - 1]);
    
    return { primaryLeafId, secondaryLeafIds, activeFutures };
}

function renderStateElements(stateToDraw, overrideColor, globalAlpha) {
    ctx.save();
    if (globalAlpha !== undefined) ctx.globalAlpha = globalAlpha;

    // Polylines
    for (let i = 0; i < stateToDraw.polylines.length; i++) {
        const pl = stateToDraw.polylines[i];
        const layerData = layers[pl.layer]; // Current visibility rules
        if (!layerData || !layerData.visible) continue;

        ctx.strokeStyle = overrideColor || layerData.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (pl.points.length > 0) {
            const sp0 = worldToScreen(pl.points[0].x, pl.points[0].y);
            ctx.moveTo(sp0.x, sp0.y);
            for (let j = 0; j < pl.points.length; j++) {
                let nextIdx = j + 1;
                if (nextIdx === pl.points.length) {
                    if (pl.closed && pl.points.length > 2) nextIdx = 0;
                    else continue;
                }
                const p1 = pl.points[j];
                const p2 = pl.points[nextIdx];
                if (p1.bulge && p1.bulge !== 0) {
                    const arc = getArcParams(p1, p2, p1.bulge);
                    if (arc) {
                        const scx = worldToScreen(arc.cx, arc.cy);
                        ctx.arc(scx.x, scx.y, arc.R * scale, -arc.startAngle, -arc.endAngle, arc.ccw);
                    } else {
                        const sp2 = worldToScreen(p2.x, p2.y);
                        ctx.lineTo(sp2.x, sp2.y);
                    }
                } else {
                    const sp2 = worldToScreen(p2.x, p2.y);
                    ctx.lineTo(sp2.x, sp2.y);
                }
            }
        }
        ctx.stroke();
    }
    
    // Labels
    for (let i = 0; i < stateToDraw.labels.length; i++) {
        const lbl = stateToDraw.labels[i]; 
        const layerData = layers[lbl.layer] || layers['0'];
        if (!layerData.visible) continue;
        
        let p1, p2, len;
        const pl = stateToDraw.polylines[lbl.plIndex];
        if (!pl) continue;
        const j = lbl.segmentIndex;
        let nextIdx = j + 1;
        if (nextIdx === pl.points.length) { if (pl.closed) nextIdx = 0; else continue; }
        p1 = pl.points[j]; p2 = pl.points[nextIdx];
        
        let midX, midY;
        if (p1.bulge && p1.bulge !== 0) {
            const arc = getArcParams(p1, p2, p1.bulge);
            if (arc) { const m = getArcMidpoint(arc); midX = m.x; midY = m.y; len = Math.abs(arc.R * (arc.endAngle - arc.startAngle)); }
            else { midX = (p1.x+p2.x)/2; midY = (p1.y+p2.y)/2; len = Math.hypot(p2.x-p1.x, p2.y-p1.y); }
        } else { midX = (p1.x+p2.x)/2; midY = (p1.y+p2.y)/2; len = Math.hypot(p2.x-p1.x, p2.y-p1.y); }
        
        const sp = worldToScreen(midX, midY);
        let prec = lbl.precision !== undefined ? lbl.precision : (documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2);
        let text = lbl.text.replace('#longitud#', len.toFixed(prec)).replace('#capa#', lbl.layer || '0');
        const sp1 = worldToScreen(p1.x, p1.y); const sp2 = worldToScreen(p2.x, p2.y);
        let angle = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x);
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(angle);
        ctx.font = '14px Inter';
        ctx.fillStyle = overrideColor || layerData.color; ctx.textAlign = 'center'; ctx.fillText(text, 0, -5);
        ctx.restore();
    }
    
    ctx.restore();
}


function assignHuesToGraph() {
    let roots = [];
    for (let id in timeMap.nodes) {
        if (!timeMap.nodes[id].parentId) {
            roots.push(id);
        }
    }
    roots.forEach(rootId => {
        if (timeMap.nodes[rootId].hue === undefined) {
            timeMap.nodes[rootId].hue = 200;
        }
        function dfsHue(nodeId) {
            const node = timeMap.nodes[nodeId];
            node.childrenIds.forEach((childId, index) => {
                const child = timeMap.nodes[childId];
                if (child.hue === undefined) {
                    if (index === 0) child.hue = node.hue;
                    else child.hue = (node.hue + (45 * index)) % 360;
                }
                dfsHue(childId);
            });
        }
        dfsHue(rootId);
    });
}
