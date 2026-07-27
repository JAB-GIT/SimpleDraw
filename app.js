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
let selectedObject = null;
let typedLength = '';

// Document & Pages
let documentSettings = {
    units: 'cm', projNum: '', projectName: '', fileName: 'Nuevo_Dibujo', draftsman: '', address: '', comments: '', lblPrecision: 2
};
let pages = [];
let selectedPageIdx = -1;

// Workspace Settings
let workspaceSettings = {
    bgColor: '#fdfbf7',
    grid: { enabled: true, type: 'absolute', color: '#ffd6d6', sizeX: 100, sizeY: 100, angle: 0 }
};

// Camera/View state
let panX = 0;
let panY = 0;
let scale = 1;

// Drawing state
let currentPolyline = null;
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
let isCopyMode = false;
let moveModifier = '';
let moveCommandInput = '';

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
    document.getElementById('print-selection').innerHTML = '';
    const sel = document.getElementById('print-selection');
    sel.innerHTML += `<option value="all">Todas (${pages.length})</option>`;
    if (selectedPageIdx >= 0) {
        sel.innerHTML += `<option value="${selectedPageIdx}">Seleccionada: ${pages[selectedPageIdx].name}</option>`;
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polylines.forEach(pl => {
        pl.points.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        });
    });
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polylines.forEach(pl => {
        pl.points.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        });
    });
    
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
    selectedPageIdx = pages.length - 1;
    draw();
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
        selectedObject = null;
        selectedPageIdx = -1;
        currentPolyline = null;
        panX = 0;
        panY = 0;
        scale = 1;
        updateLayersUI();
        updateSettingsUI();
        updatePropertiesPanel();
        draw();
    }
});

btnSave.addEventListener('click', () => {
    const data = { polylines, labels, layers, workspaceSettings, documentSettings, pages };
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
                
                selectedObject = null;
                selectedPageIdx = -1;
                currentPolyline = null;
                updateLayersUI();
                updateSettingsUI();
                updatePropertiesPanel();
                fitToScreen();
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
function rotatePoint(x, y, rad) { return { x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) }; }

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
    
    if (selectedObject) {
        if (selectedObject.type === 'polyline' && polylines[selectedObject.plIndex]) {
            propLayer.value = polylines[selectedObject.plIndex].layer;
        } else if (selectedObject.type === 'label' && labels[selectedObject.index]) {
            propLayer.value = labels[selectedObject.index].layer || '0';
        }
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
});

function fitToScreen() {
    if (polylines.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polylines.forEach(pl => {
        pl.points.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        });
    });
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
        currentPolyline = null;
        typedLength = '';
        lengthInputOverlay.style.display = 'none';
        
        moveState = (currentTool === 'move') ? 'SELECTING' : 'NONE';
        moveSelection = [];
        moveOrigin = null; moveDest = null; moveModifier = ''; moveCommandInput = ''; isCopyMode = false;
        
        if (currentTool === 'select' || currentTool === 'label') canvas.style.cursor = 'default';
        else if (currentTool === 'polyline') canvas.style.cursor = 'none';
        else if (currentTool === 'move') canvas.style.cursor = 'crosshair';
        draw();
    });
});
canvas.style.cursor = 'default';

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
            const dist = distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y);
            if (dist < closestDist) { closestDist = dist; closestInfo = { plIndex: i, segmentIndex: j }; }
        }
        if (pl.closed && pl.points.length > 2) {
            const p1 = pl.points[pl.points.length - 1]; const p2 = pl.points[0];
            const dist = distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y);
            if (dist < closestDist) { closestDist = dist; closestInfo = { plIndex: i, segmentIndex: pl.points.length - 1 }; }
        }
    }
    return closestInfo;
}

function getSnapPoint(wx, wy) {
    if (!snapToggle.checked) return null;
    const SNAP_DIST_WORLD = 15 / scale;
    let closestDist = SNAP_DIST_WORLD; let closestPoint = null;

    for (const pl of polylines) {
        if (!layers[pl.layer].visible) continue;
        for (const p of pl.points) {
            const dist = Math.hypot(p.x - wx, p.y - wy);
            if (dist < closestDist) { closestDist = dist; closestPoint = { x: p.x, y: p.y }; }
        }
    }
    
    if (currentPolyline) {
        for (const p of currentPolyline.points) {
            const dist = Math.hypot(p.x - wx, p.y - wy);
            if (dist < closestDist) { closestDist = dist; closestPoint = { x: p.x, y: p.y }; }
        }
    }
    
    if (!closestPoint && workspaceSettings.grid.enabled && workspaceSettings.grid.type === 'absolute') {
        const rad = workspaceSettings.grid.angle * Math.PI / 180;
        const unrot = rotatePoint(wx, wy, -rad);
        const gx = workspaceSettings.grid.sizeX; const gy = workspaceSettings.grid.sizeY;
        const nearestX = Math.round(unrot.x / gx) * gx; const nearestY = Math.round(unrot.y / gy) * gy;
        const trueWorld = rotatePoint(nearestX, nearestY, rad);
        const dist = Math.hypot(trueWorld.x - wx, trueWorld.y - wy);
        if (dist < closestDist) { closestDist = dist; closestPoint = { x: trueWorld.x, y: trueWorld.y }; }
    }
    return closestPoint;
}

function updateWorldCoordinates(rawWx, rawWy) {
    rawWorldX = rawWx; rawWorldY = rawWy;
    snapPoint = getSnapPoint(rawWx, rawWy);
    worldX = rawWx; worldY = rawWy;
    
    let isOrthoApplicable = false;
    let refPoint = null;
    
    if (currentTool === 'polyline' && currentPolyline && currentPolyline.points.length > 0) {
        refPoint = currentPolyline.points[currentPolyline.points.length - 1];
        isOrthoApplicable = true;
    } else if (currentTool === 'move' && moveState === 'DESTINATION' && moveOrigin) {
        refPoint = moveOrigin;
        isOrthoApplicable = true;
    }
    
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
    if (!selectedObject) {
        propertiesPanel.style.display = 'none';
        return;
    }
    propertiesPanel.style.display = 'block';
    
    if (selectedObject.type === 'page') {
        const p = pages[selectedObject.index];
        if (!p) return;
        propType.textContent = 'Página (Layout)';
        propLayerContainer.style.display = 'none';
        propLengthContainer.style.display = 'none';
        propLblSizeContainer.style.display = 'none';
        propLblPrecContainer.style.display = 'none';
        propPageContainer.style.display = 'flex';
    } else if (selectedObject.type === 'polyline') {
        const pl = polylines[selectedObject.plIndex];
        if (!pl) return;
        propType.textContent = 'Polilínea'; 
        propLayer.value = pl.layer;
        propLayerContainer.style.display = 'block';
        propLengthContainer.style.display = 'block';
        propLblSizeContainer.style.display = 'none';
        propLblPrecContainer.style.display = 'none';
        propPageContainer.style.display = 'none';
        let len = 0;
        for(let i=1; i<pl.points.length; i++) len += Math.hypot(pl.points[i].x - pl.points[i-1].x, pl.points[i].y - pl.points[i-1].y);
        if (pl.closed && pl.points.length > 2) len += Math.hypot(pl.points[0].x - pl.points[pl.points.length-1].x, pl.points[0].y - pl.points[pl.points.length-1].y);
        propLength.textContent = len.toFixed(2);
    } else if (selectedObject.type === 'label') {
        const lbl = labels[selectedObject.index];
        if (!lbl) return;
        propType.textContent = 'Etiqueta'; 
        propLayer.value = lbl.layer || '0'; 
        propLength.textContent = '-';
        propLblSize.value = lbl.printSize || 5;
        propLblPrec.value = lbl.precision !== undefined ? lbl.precision : '';
        propLayerContainer.style.display = 'block';
        propLengthContainer.style.display = 'block';
        propLblSizeContainer.style.display = 'block';
        propLblPrecContainer.style.display = 'block';
        propPageContainer.style.display = 'none';
    }
}
propLayer.addEventListener('change', (e) => {
    if (selectedObject && selectedObject.type === 'polyline') { polylines[selectedObject.plIndex].layer = e.target.value; draw(); }
    else if (selectedObject && selectedObject.type === 'label') { labels[selectedObject.index].layer = e.target.value; draw(); }
});
propLblSize.addEventListener('change', (e) => {
    if (selectedObject && selectedObject.type === 'label') { 
        labels[selectedObject.index].printSize = parseFloat(e.target.value) || 5; 
        draw();
    }
});
propLblPrec.addEventListener('change', (e) => {
    if (selectedObject && selectedObject.type === 'label') { 
        const val = e.target.value;
        if (val === '') delete labels[selectedObject.index].precision;
        else labels[selectedObject.index].precision = parseInt(val) || 0;
        draw();
    }
});
btnEditPage.addEventListener('click', () => {
    if (selectedObject && selectedObject.type === 'page') {
        openPageModal(selectedObject.index);
    }
});
btnDelete.addEventListener('click', deleteSelected);
function deleteSelected() {
    if (selectedObject && selectedObject.type === 'polyline') {
        polylines[selectedObject.plIndex].layer = 'basura'; selectedObject = null; updatePropertiesPanel(); draw();
    } else if (selectedObject && selectedObject.type === 'label') {
        labels.splice(selectedObject.index, 1); selectedObject = null; updatePropertiesPanel(); draw();
    } else if (selectedObject && selectedObject.type === 'page') {
        pages.splice(selectedObject.index, 1); selectedObject = null; selectedPageIdx = -1; draw();
    }
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
        
        if (currentTool === 'select' && e.button === 0) { selectedObject = null; selectedPageIdx = -1; updatePropertiesPanel(); draw(); }
        return;
    }

    if (e.button === 0) {
        if (currentTool === 'polyline') {
            if (!currentPolyline) currentPolyline = { layer: currentLayer, points: [], closed: false };
            if (currentPolyline.points.length >= 2) {
                const firstPt = currentPolyline.points[0];
                if (Math.hypot(worldX - firstPt.x, worldY - firstPt.y) < 1e-4) {
                    currentPolyline.closed = true;
                    polylines.push(currentPolyline);
                    currentPolyline = null;
                    typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
                    return;
                }
            }
            currentPolyline.points.push({ x: worldX, y: worldY });
            typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
        } else if (currentTool === 'select') {
            const hit = getClosestSegment(worldX, worldY);
            if (hit) {
                if (hit.type === 'page') {
                    selectedObject = { type: 'page', index: hit.index };
                    selectedPageIdx = hit.index;
                    draggingPage = hit.index;
                    const origX = pages[hit.index].x;
                    const origY = pages[hit.index].y;
                    
                    const onMouseUpPage = (eUp) => {
                        if (eUp.ctrlKey) {
                            const newPage = JSON.parse(JSON.stringify(pages[draggingPage]));
                            pages[draggingPage].x = origX;
                            pages[draggingPage].y = origY;
                            pages.push(newPage);
                            selectedObject = { type: 'page', index: pages.length - 1 };
                            selectedPageIdx = pages.length - 1;
                        }
                        draggingPage = null; 
                        document.removeEventListener('mouseup', onMouseUpPage); 
                        draw();
                    };
                    document.addEventListener('mouseup', onMouseUpPage);
                } else if (hit.type === 'label') {
                    selectedObject = { type: 'label', index: hit.index };
                } else {
                    selectedObject = { type: 'polyline', plIndex: hit.plIndex, segmentIndex: hit.segmentIndex };
                }
            } else {
                selectedObject = null;
                selectedPageIdx = -1;
            }
            updatePropertiesPanel();
            draw();
        } else if (currentTool === 'label') {
            const hit = getClosestSegment(worldX, worldY);
            if (hit && !hit.type) {
                const text = prompt("Ingrese el texto (use #longitud# o #capa# para variables):", "L = #longitud#");
                if (text) { labels.push({ text: text, plIndex: hit.plIndex, segmentIndex: hit.segmentIndex, layer: currentLayer }); draw(); }
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
        }
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (currentTool === 'polyline' && currentPolyline) {
        if (currentPolyline.points.length > 1) polylines.push(currentPolyline);
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
                            moveModifier = '';
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
        }

        if (currentTool !== 'polyline') {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            const btnPolyline = document.getElementById('tool-polyline');
            if (btnPolyline) btnPolyline.classList.add('active');
            currentTool = 'polyline';
            currentPolyline = null;
            selectedObject = null;
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
                    currentPolyline.closed = true;
                    polylines.push(currentPolyline);
                    currentPolyline = null;
                    typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
                    return;
                }
            }
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
                    moveModifier = ''; // remove array modifier when back to normal move
                }
                draw();
            }
        } else if (e.key === 'Escape') {
            moveState = 'SELECTING'; moveSelection = []; moveOrigin = null; moveDest = null; moveModifier = ''; moveCommandInput = ''; isCopyMode = false;
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
                            moveModifier = '';
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
            if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '/' || e.key === '*') {
                moveCommandInput += e.key; lengthInput.value = moveCommandInput; draw();
            } else if (e.key === 'Backspace') {
                moveCommandInput = moveCommandInput.slice(0, -1); lengthInput.value = moveCommandInput; draw();
            }
        }
    } else if (currentTool === 'polyline') {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
            typedLength += e.key; lengthInput.value = typedLength; lengthInputOverlay.style.display = 'flex'; updateWorldCoordinates(rawWorldX, rawWorldY); draw();
        } else if (e.key === 'Backspace') {
            typedLength = typedLength.slice(0, -1); lengthInput.value = typedLength;
            if (typedLength === '') lengthInputOverlay.style.display = 'none';
            updateWorldCoordinates(rawWorldX, rawWorldY); draw();
        } else if (e.key === 'Enter') {
            if (typedLength !== '' && currentPolyline) {
                currentPolyline.points.push({ x: worldX, y: worldY }); typedLength = ''; lengthInputOverlay.style.display = 'none'; updateWorldCoordinates(rawWorldX, rawWorldY); draw();
            } else if (currentPolyline) {
                if (currentPolyline.points.length > 1) polylines.push(currentPolyline);
                currentPolyline = null; draw();
            }
        } else if (e.key === 'Escape') {
            typedLength = ''; lengthInputOverlay.style.display = 'none';
            if (currentPolyline) { if (currentPolyline.points.length > 1) polylines.push(currentPolyline); currentPolyline = null; }
            draw();
        } else if (e.key.toLowerCase() === 'c') {
            if (currentPolyline && currentPolyline.points.length >= 2) {
                currentPolyline.closed = true;
                polylines.push(currentPolyline);
                currentPolyline = null;
                typedLength = ''; lengthInputOverlay.style.display = 'none'; draw();
            }
        }
    } else if (currentTool === 'select' || currentTool === 'label') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelected();
        } else if (e.key === 'Escape') {
            selectedObject = null; selectedPageIdx = -1; updatePropertiesPanel(); draw();
        }
    }
});

// Render
function getSegmentData(plIndex, segIndex) {
    const pl = polylines[plIndex]; if (!pl) return null;
    const p1 = pl.points[segIndex]; let p2;
    if (segIndex === pl.points.length - 1 && pl.closed) p2 = pl.points[0]; else p2 = pl.points[segIndex + 1];
    if (!p1 || !p2) return null;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    return { p1, p2, len, layer: pl.layer };
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
    
    // 4. Draw Polylines
    for (let i = 0; i < polylines.length; i++) {
        const pl = polylines[i];
        const layerData = layers[pl.layer];
        if (!layerData || !layerData.visible) continue;
        const isSelected = (selectedObject && selectedObject.type === 'polyline' && selectedObject.plIndex === i) || 
                           (currentTool === 'move' && moveSelection.some(s => s.type === 'polyline' && s.index === i));
        ctx.strokeStyle = isSelected ? (currentTool === 'move' ? '#ffa500' : '#4a90e2') : layerData.color;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        for (let j = 0; j < pl.points.length; j++) {
            const sp = worldToScreen(pl.points[j].x, pl.points[j].y);
            if (j === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
        }
        if (pl.closed && pl.points.length > 2) ctx.closePath();
        ctx.stroke();
    }
    
    // 5. Draw Labels
    for (let i = 0; i < labels.length; i++) {
        const lbl = labels[i]; const layerData = layers[lbl.layer] || layers['0'];
        if (!layerData.visible) continue;
        const segData = getSegmentData(lbl.plIndex, lbl.segmentIndex); if (!segData) continue;
        const midX = (segData.p1.x + segData.p2.x) / 2; const midY = (segData.p1.y + segData.p2.y) / 2;
        const sp = worldToScreen(midX, midY);
        let prec = lbl.precision !== undefined ? lbl.precision : (documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2);
        let text = lbl.text.replace('#longitud#', segData.len.toFixed(prec)); text = text.replace('#capa#', segData.layer);
        const sp1 = worldToScreen(segData.p1.x, segData.p1.y); const sp2 = worldToScreen(segData.p2.x, segData.p2.y);
        let angle = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x);
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(angle);
        ctx.font = '14px Inter'; const metrics = ctx.measureText(text);
        const isSelected = (selectedObject && selectedObject.type === 'label' && selectedObject.index === i) ||
                           (currentTool === 'move' && moveSelection.some(s => s.type === 'label' && s.index === i));
        if (isSelected) { ctx.fillStyle = currentTool === 'move' ? 'rgba(255, 165, 0, 0.3)' : 'rgba(74, 144, 226, 0.3)'; ctx.fillRect(-metrics.width/2 - 4, - 12 - 4 - 5, metrics.width + 8, 20); }
        ctx.fillStyle = layerData.color; ctx.textAlign = 'center'; ctx.fillText(text, 0, -5);
        ctx.restore();
    }

    // 5. Draw Currently drawing polyline
    if (currentTool === 'polyline' && currentPolyline && currentPolyline.points.length > 0) {
        const layerData = layers[currentLayer];
        ctx.strokeStyle = layerData ? layerData.color : '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < currentPolyline.points.length; i++) {
            const sp = worldToScreen(currentPolyline.points[i].x, currentPolyline.points[i].y);
            if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
        }
        const cursorPos = worldToScreen(worldX, worldY); ctx.lineTo(cursorPos.x, cursorPos.y); ctx.stroke();
        const lastPoint = currentPolyline.points[currentPolyline.points.length - 1];
        const lastPointSp = worldToScreen(lastPoint.x, lastPoint.y);
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
                    for (let j = 0; j < pl.points.length; j++) {
                        const sp = worldToScreen(pl.points[j].x + offset.x, pl.points[j].y + offset.y);
                        if (j === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
                    }
                    if (pl.closed && pl.points.length > 2) ctx.closePath();
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
    
    // 6. Draw Snapping
    if (snapPoint && typedLength === '') {
        const sp = worldToScreen(snapPoint.x, snapPoint.y);
        ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; const size = 6;
        ctx.strokeRect(sp.x - size/2, sp.y - size/2, size, size);
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
        ctx.fillStyle = (selectedPageIdx === idx) ? '#ff4444' : '#4a90e2';
        ctx.beginPath();
        ctx.arc(spAnchor.x, spAnchor.y, 4, 0, Math.PI*2);
        ctx.fill();
        
        if (currentTool === 'select') {
            ctx.strokeStyle = (selectedPageIdx === idx) ? '#ff4444' : '#4a90e2';
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
    
    let pagesToPrint = [];
    if (selOpt === 'all') {
        pagesToPrint = pages;
    } else if (selOpt === 'selected') {
        if (selectedPageIdx >= 0) pagesToPrint = [pages[selectedPageIdx]];
    } else {
        pagesToPrint = [pages[parseInt(selOpt)]];
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
        let w_mm = formats[p.format][0];
        let h_mm = formats[p.format][1];
        let orient = p.orient === 'landscape' ? 'l' : 'p';
        if (orient === 'l') { const t = w_mm; w_mm = h_mm; h_mm = t; }
        
        if (isMultiple || i === 0) {
            pdf = new jsPDF({ orientation: orient, unit: 'mm', format: p.format.toLowerCase() });
        } else {
            pdf.addPage(p.format.toLowerCase(), orient);
        }
        
        offCanvas.width = w_mm * DPI_SCALE;
        offCanvas.height = h_mm * DPI_SCALE;
        
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
            offCtx.fillStyle = p.bgColor;
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
        
        offCtx.fillStyle = isColor ? '#000000' : '#000000';
        const mmToScreen = 1 * mu * p.scale * tempScale;
        offCtx.font = `${5 * mmToScreen}px Inter`;
        const footerY = sph - mb + (1 * mmToScreen);
        
        offCtx.textBaseline = 'top';
        offCtx.textAlign = 'left'; offCtx.fillText(parseVars(p.footL, p), ml, footerY);
        offCtx.textAlign = 'center'; offCtx.fillText(parseVars(p.footC, p), spw/2, footerY);
        offCtx.textAlign = 'right'; offCtx.fillText(parseVars(p.footR, p), spw - mr, footerY);
        offCtx.textBaseline = 'alphabetic';

        // 3. Geometry (Polylines, Labels)
        for (let j = 0; j < polylines.length; j++) {
            const pl = polylines[j];
            const layerData = layers[pl.layer];
            if (!layerData || !layerData.visible) continue;
            
            offCtx.strokeStyle = isColor ? layerData.color : '#000000';
            offCtx.lineWidth = 1 * DPI_SCALE / 2;
            offCtx.beginPath();
            for (let k = 0; k < pl.points.length; k++) {
                const sp = offWorldToScreen(pl.points[k].x, pl.points[k].y);
                if (k === 0) offCtx.moveTo(sp.x, sp.y); else offCtx.lineTo(sp.x, sp.y);
            }
            if (pl.closed && pl.points.length > 2) offCtx.closePath();
            offCtx.stroke();
        }
        
        for (let j = 0; j < labels.length; j++) {
            const lbl = labels[j];
            const layerData = layers[lbl.layer || '0'];
            if (!layerData || !layerData.visible) continue;
            const segData = getSegmentData(lbl.plIndex, lbl.segmentIndex); if (!segData) continue;
            const midX = (segData.p1.x + segData.p2.x) / 2; const midY = (segData.p1.y + segData.p2.y) / 2;
            const sp = offWorldToScreen(midX, midY);
            let prec = lbl.precision !== undefined ? lbl.precision : (documentSettings.lblPrecision !== undefined ? documentSettings.lblPrecision : 2);
            let text = lbl.text.replace('#longitud#', segData.len.toFixed(prec)); text = text.replace('#capa#', segData.layer);
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
            let filename = parseVars(namePattern, p) + ".pdf";
            pdf.save(filename);
        }
    }
    
    if (!isMultiple) {
        let filename = parseVars(namePattern, pagesToPrint[0]);
        if (pagesToPrint.length > 1) filename = parseVars(documentSettings.projNum + "_Plano", pagesToPrint[0]);
        pdf.save(filename + ".pdf");
    }
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
                pl.points = pl.points.map(p => ({ x: p.x + vectorOffset.x, y: p.y + vectorOffset.y }));
            } else {
                for (let i = 1; i <= numCopies; i++) {
                    const offset = { x: vectorOffset.x * i, y: vectorOffset.y * i };
                    newPolylines.push({ layer: pl.layer, closed: pl.closed, points: pl.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })) });
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
    
    moveState = 'SELECTING';
    moveSelection = [];
    moveOrigin = null;
    moveDest = null;
    moveModifier = '';
    moveCommandInput = '';
    isCopyMode = false;
    document.getElementById('length-input-overlay').style.display = 'none';
    draw();
}
