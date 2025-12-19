// ============================================================
// CONFIGURAÇÕES DE ESCALA (MTA / GTA CORE)
// ============================================================
const MAP_SIZE = 6000; 
const IMG_SIZE = 2500; 
const SCALE = IMG_SIZE / MAP_SIZE;

let zoom = 1.0; 
let isDragging = false;
let startX, startY, mapX = 0, mapY = 0;

// Variáveis de Posição e Suavização (Fluidez)
let playerPosX = 0;
let playerPosY = 0;
let playerAngle = 0;
let currentRotation = 0; // Para o mapa girar liso

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
// INICIALIZAÇÃO E ESCONDER HUD ORIGINAL
// ============================================================
if (typeof cef !== 'undefined') {
    cef.on("browser:ready", () => {
        // Esconde tudo que é nativo do GTA
        cef.emit("game:hud:setComponentVisible", "radar", false);
        cef.emit("game:hud:setComponentVisible", "interface", false);
    });
}

// ============================================================
// SISTEMA DE MAPA GRANDE (ZOOM, ARRASTE, MARCAÇÃO)
// ============================================================

function toggleMapa() {
    if (!mapLayer) return;
    if (mapLayer.style.display === 'none' || mapLayer.style.display === '') {
        mapLayer.style.display = 'block';
        if (hud) hud.style.display = 'none';
        if (typeof cef !== 'undefined') cef.emit("toggleCursor", true);
        renderizarBlipsNoMapa();
    } else {
        mapLayer.style.display = 'none';
        if (hud) hud.style.display = 'block';
        if (typeof cef !== 'undefined') cef.emit("toggleCursor", false);
    }
}

// Zoom com a roda do mouse (MANTIDO)
window.addEventListener('wheel', (e) => {
    if (mapLayer && mapLayer.style.display === 'block') {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoom = Math.min(Math.max(0.5, zoom + delta), 4.0);
        mapImg.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
        canvas.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
        renderizarBlipsNoMapa();
    }
});

// Arrastar Mapa (MANTIDO)
if (mapLayer) {
    mapLayer.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            startX = e.clientX - mapX;
            startY = e.clientY - mapY;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        mapX = e.clientX - startX;
        mapY = e.clientY - startY;
        mapImg.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
        canvas.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
        renderizarBlipsNoMapa();
    });

    window.addEventListener('mouseup', () => isDragging = false);
}

// Marcar Local com Botão Direito (MANTIDO)
mapLayer?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = mapImg.getBoundingClientRect();
    const pxX = (e.clientX - rect.left) / zoom;
    const pxY = (e.clientY - rect.top) / zoom;
    const centerX = IMG_SIZE / 2;
    const centerY = IMG_SIZE / 2;
    const gtaX = (pxX - centerX) / SCALE;
    const gtaY = (centerY - pxY) / SCALE;
    marcarLocal(gtaX, gtaY, "Destino");
});

function marcarLocal(x, y, nome) {
    if (typeof cef !== 'undefined') {
        cef.emit("setGPS", x, y);
    }
}

// ============================================================
// LÓGICA DE ATUALIZAÇÃO FLUIDA (ANIMATION FRAME)
// ============================================================

function renderizarBlipsNoMapa() {
    if (!canvas) return;
    canvas.innerHTML = ''; 
    blipsFixos.forEach(blip => {
        const pos = gtaToPixels(blip.x, blip.y);
        const div = document.createElement('div');
        div.className = 'blip-fixo';
        div.innerHTML = blip.icon;
        div.style.left = ((pos.x * zoom) + mapX) + 'px';
        div.style.top = ((pos.y * zoom) + mapY) + 'px';
        canvas.appendChild(div);
    });

    const pPos = gtaToPixels(playerPosX, playerPosY);
    const pDiv = document.createElement('div');
    pDiv.id = 'player-big-blip';
    pDiv.innerHTML = '▲';
    pDiv.style.color = '#3498db';
    pDiv.style.position = 'absolute';
    pDiv.style.fontSize = '20px';
    pDiv.style.left = ((pPos.x * zoom) + mapX) + 'px';
    pDiv.style.top = ((pPos.y * zoom) + mapY) + 'px';
    pDiv.style.transform = `translate(-50%, -50%) rotate(${playerAngle}deg)`;
    canvas.appendChild(pDiv);
}

// Função que roda 60 vezes por segundo para dar fluidez
function loopFluido() {
    const minimap = document.getElementById("map-img");
    const arrow = document.querySelector(".player-arrow");
    const pos = gtaToPixels(playerPosX, playerPosY);

    if (minimap) {
        // Suaviza a rotação do mapa (Interpolação)
        let targetRot = -playerAngle; 
        let diff = targetRot - currentRotation;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        currentRotation += diff * 0.15; // 0.15 é a velocidade da suavização

        minimap.style.left = `calc(50% - ${pos.x}px)`;
        minimap.style.top = `calc(50% - ${pos.y}px)`;
        minimap.style.transform = `rotate(${currentRotation}deg)`;
        minimap.style.transformOrigin = `${pos.x}px ${pos.y}px`;
    }

    // A seta gira conforme o playerAngle no centro
    if (arrow) {
        arrow.style.transform = `translate(-50%, -50%) rotate(0deg)`; // No GTA SA a seta é fixa no centro quando o mapa gira
    }

    requestAnimationFrame(loopFluido);
}
requestAnimationFrame(loopFluido);

// ============================================================
// HUD PRINCIPAL (RELÓGIO, DINHEIRO, EVENTOS)
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
    cef.on("tentarAbrirMapa", () => {
        toggleMapa();
    });

    cef.on("updateHud", (money, bank) => {
        const hand = document.getElementById("money-hand");
        const bk = document.getElementById("money-bank");
        if (hand) hand.innerText = money.toLocaleString('pt-BR');
        if (bk) bk.innerText = bank.toLocaleString('pt-BR');
    });

    cef.on("updatePos", (x, y, angle) => {
        playerPosX = x;
        playerPosY = y;
        playerAngle = angle;

        if (mapLayer && mapLayer.style.display === 'block') {
            renderizarBlipsNoMapa();
        }
    });
}