// ============================================================
// CONFIGURAÇÕES DE ESCALA (MTA / GTA CORE)
// ============================================================
const MAP_SIZE = 6000; 
const IMG_SIZE = 2500; 
const SCALE = IMG_SIZE / MAP_SIZE;

let zoom = 1.0; 
let isDragging = false;
let startX, startY, mapX = 0, mapY = 0;

const mapLayer = document.getElementById('big-map-layer');
const mapImg = document.getElementById('full-map-img');
const canvas = document.getElementById('map-canvas');
const hud = document.getElementById('main-hud');

// Lista de locais para ícones (Blips) visíveis no mapa grande
const blipsFixos = [
    {id: 'hosp', x: 1242, y: -1694, icon: '🏥'},
    {id: 'police', x: 1543, y: -1675, icon: '🚔'},
    {id: 'mecanic', x: -2024, y: 156, icon: '🔧'}
];

// Conversor Global de Coordenadas
function gtaToPixels(x, y) {
    return { 
        x: (IMG_SIZE / 2) + (x * SCALE), 
        y: (IMG_SIZE / 2) - (y * SCALE) 
    };
}

// ============================================================
// LÓGICA DO MAPA GRANDE (TECLA H)
// ============================================================

function centralizarMapaNoCentroDoMundo() {
    zoom = 1.0; 
    // Posiciona o mapa para que a coordenada 0,0 fique no meio da tela do jogador
    mapX = (window.innerWidth / 2) - (IMG_SIZE / 2);
    mapY = (window.innerHeight / 2) - (IMG_SIZE / 2);

    mapImg.style.transform = `scale(${zoom})`;
    mapImg.style.left = mapX + 'px';
    mapImg.style.top = mapY + 'px';
    
    renderizarBlipsNoMapa();
    atualizarMarcadorGPS();
}

function renderizarBlipsNoMapa() {
    blipsFixos.forEach(local => {
        let el = document.getElementById(`blip-${local.id}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `blip-${local.id}`;
            el.className = 'blip-no-mapa';
            el.innerHTML = local.icon;
            canvas.appendChild(el);
        }
        const pos = gtaToPixels(local.x, local.y);
        el.style.left = ((pos.x * zoom) + mapX) + 'px';
        el.style.top = ((pos.y * zoom) + mapY) + 'px';
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
        const abrindo = (mapLayer.style.display === 'none' || mapLayer.style.display === '');
        mapLayer.style.display = abrindo ? 'block' : 'none';
        hud.style.display = abrindo ? 'none' : 'block';
        
        if (abrindo) {
            setTimeout(centralizarMapaNoCentroDoMundo, 10);
            // AQUI: Ativa o mouse e tira o foco do teclado do jogo
            if (typeof cef !== 'undefined') {
                cef.emit("toggleCursor", true);
                cef.emit("setFocus", true); 
            }
        } else {
            // AQUI: Desativa o mouse e devolve o foco pro jogo
            if (typeof cef !== 'undefined') {
                cef.emit("toggleCursor", false);
                cef.emit("setFocus", false);
            }
        }
    }
});

// Movimentação do Mapa (Drag)
mapLayer.addEventListener('mousedown', (e) => { 
    isDragging = true; 
    startX = e.clientX - mapX; 
    startY = e.clientY - mapY; 
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    mapX = e.clientX - startX;
    mapY = e.clientY - startY;
    mapImg.style.left = mapX + 'px';
    mapImg.style.top = mapY + 'px';
    renderizarBlipsNoMapa();
    atualizarMarcadorGPS();
});

window.addEventListener('mouseup', () => isDragging = false);

// Zoom
mapLayer.addEventListener('wheel', (e) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const nZoom = zoom * delta;
    if (nZoom > 0.2 && nZoom < 3.0) {
        zoom = nZoom;
        mapImg.style.transform = `scale(${zoom})`;
        renderizarBlipsNoMapa();
        atualizarMarcadorGPS();
    }
});

// Função de Marcar GPS (Usada pelos botões e clique)
function marcarLocal(gx, gy, nome) {
    const pos = gtaToPixels(gx, gy);
    const m = document.getElementById('gps-destination');
    if(m) {
        m.dataset.px = pos.x; 
        m.dataset.py = pos.y;
        m.style.display = 'block';
        atualizarMarcadorGPS();
    }
    if (typeof cef !== 'undefined') cef.emit("setGPSRoute", gx, gy);
}

function atualizarMarcadorGPS() {
    const m = document.getElementById('gps-destination');
    if (!m || !m.dataset.px) return;
    m.style.left = ((parseFloat(m.dataset.px) * zoom) + mapX) + 'px';
    m.style.top = ((parseFloat(m.dataset.py) * zoom) + mapY) + 'px';
}

// Clique para marcar
mapImg.addEventListener('click', (e) => {
    if (isDragging) return;
    const rect = mapImg.getBoundingClientRect();
    const pxX = (e.clientX - rect.left) / zoom;
    const pxY = (e.clientY - rect.top) / zoom;
    const centerX = IMG_SIZE / 2;
    const centerY = IMG_SIZE / 2;
    const gtaX = (pxX - centerX) / SCALE;
    const gtaY = (centerY - pxY) / SCALE;
    marcarLocal(gtaX, gtaY, "Destino");
});

// ============================================================
// HUD PRINCIPAL (RELÓGIO, DINHEIRO, RADAR)
// ============================================================

function updateClock() {
    const now = new Date();
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        clockElement.innerText = String(now.getHours()).padStart(2, '0') + ":" + 
                                 String(now.getMinutes()).padStart(2, '0');
    }
}
setInterval(updateClock, 1000);
updateClock();

if (typeof cef !== 'undefined') {
    cef.on("updateHud", (money, bank) => {
        const hand = document.getElementById("money-hand");
        const bk = document.getElementById("money-bank");
        if (hand) hand.innerText = money.toLocaleString('pt-BR');
        if (bk) bk.innerText = bank.toLocaleString('pt-BR');
    });

    cef.on("updatePos", (x, y, angle) => {
        const minimap = document.getElementById("map-img");
        const arrow = document.querySelector(".player-arrow");
        const pos = gtaToPixels(x, y);

        if (minimap) {
            minimap.style.left = `calc(85px - ${pos.x}px)`;
            minimap.style.top = `calc(85px - ${pos.y}px)`;
        }
        if (arrow) {
            arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        }
    });
}
