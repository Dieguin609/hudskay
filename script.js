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
let currentRotation = 0;      // Suavização do mapa (Radar)
let currentArrowRotation = 0; // Suavização da seta

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
// FUNÇÕES DE EXIBIÇÃO E OCULTAR HUD ORIGINAL
// ============================================================
// Esconde a interface nativa do jogo via CEF (se disponível)
        if (typeof cef !== "undefined" && cef.emit) {
            cef.emit("game:hud:setComponentVisible", "interface", false);
            cef.emit("game:hud:setComponentVisible", "radar", false);
        }

function toggleMapa() {
    if (!mapLayer) return;
    const isVisible = mapLayer.style.display === 'block';
    
    if (!isVisible) {
        mapLayer.style.display = 'block';
        if (hud) hud.style.display = 'none';
        
        // Centraliza o mapa no jogador ao abrir
        const pos = gtaToPixels(playerPosX, playerPosY);
        mapX = (window.innerWidth / 2) - (pos.x * zoom);
        mapY = (window.innerHeight / 2) - (pos.y * zoom);
        
        renderizarBlipsNoMapa();
    } else {
        mapLayer.style.display = 'none';
        if (hud) hud.style.display = 'block';
    }
}

// ============================================================
// EVENTOS DE CONTROLE (TECLAS E MOUSE)
// ============================================================
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // M abre e fecha a imagem do mapa
    if (key === 'm') toggleMapa();
    
    // H fecha o mapa e pede para o Pawn tirar o foco do mouse
    if (key === 'h') {
        if (typeof cef !== 'undefined') {
            if (mapLayer && mapLayer.style.display === 'block') toggleMapa();
            // CHAMA O EVENTO QUE VOCÊ CONFIGUROU NO PAWN (cef_subscribe)
            cef.emit("server:setFocus", id);
        }
    }
});

// LOGICA DE ZOOM ESTILO GTA V: FOCA NA SETA DO MOUSE
window.addEventListener('wheel', (e) => {
    if (mapLayer && mapLayer.style.display === 'block') {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const oldZoom = zoom;
        
        zoom = Math.min(Math.max(0.4, zoom + delta), 4.5);
        
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Ajusta posição para o zoom seguir o cursor
        mapX -= (mouseX - mapX) * (zoom / oldZoom - 1);
        mapY -= (mouseY - mapY) * (zoom / oldZoom - 1);
        
        renderizarBlipsNoMapa();
    }
}, { passive: false });

// ARRASTAR O MAPA
if (mapLayer) {
    mapLayer.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            startX = e.clientX - mapX;
            startY = e.clientY - mapY;
            mapLayer.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || mapLayer.style.display !== 'block') return;
        mapX = e.clientX - startX;
        mapY = e.clientY - startY;
        renderizarBlipsNoMapa();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        mapLayer.style.cursor = 'default';
    });
}

// Marcar Local com Botão Direito (GPS)
mapLayer?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = mapImg.getBoundingClientRect();
    const pxX = (e.clientX - rect.left) / zoom;
    const pxY = (e.clientY - rect.top) / zoom;
    const gtaX = (pxX - (IMG_SIZE / 2)) / SCALE;
    const gtaY = ((IMG_SIZE / 2) - pxY) / SCALE;
    if (typeof cef !== 'undefined') cef.emit("setGPS", gtaX, gtaY);
});

// ============================================================
// RENDERIZAÇÃO E ATUALIZAÇÃO (SETAS E BLIPS)
// ============================================================

function renderizarBlipsNoMapa() {
    if (!canvas || !mapImg) return;
    
    const transformStyle = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
    mapImg.style.transform = transformStyle;
    canvas.style.transform = transformStyle;
    
    canvas.innerHTML = ''; 

    // Blips Fixos
    blipsFixos.forEach(blip => {
        const pos = gtaToPixels(blip.x, blip.y);
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = `${pos.x}px`;
        div.style.top = `${pos.y}px`;
        div.style.transform = `translate(-50%, -50%) scale(${1.2/zoom})`; 
        div.innerHTML = blip.icon;
        canvas.appendChild(div);
    });

    // Seta do Jogador - CORRIGIDA: usei "-playerAngle" para desinverter
    const pPos = gtaToPixels(playerPosX, playerPosY);
    const pDiv = document.createElement('div');
    pDiv.innerHTML = '▲';
    pDiv.style.position = 'absolute';
    pDiv.style.color = '#3498db';
    pDiv.style.fontSize = '22px';
    pDiv.style.left = `${pPos.x}px`;
    pDiv.style.top = `${pPos.y}px`;
    pDiv.style.transform = `translate(-50%, -50%) rotate(${-playerAngle}deg) scale(${1.2/zoom})`;
    canvas.appendChild(pDiv);
}

function loopFluido() {
    const minimap = document.getElementById("map-img");
    const arrow = document.querySelector(".player-arrow");
    const pos = gtaToPixels(playerPosX, playerPosY);

    if (minimap) {
        let targetRot = -playerAngle; 
        let diff = targetRot - currentRotation;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        currentRotation += diff * 0.15; 

        minimap.style.left = `calc(50% - ${pos.x}px)`;
        minimap.style.top = `calc(50% - ${pos.y}px)`;
        minimap.style.transformOrigin = `${pos.x}px ${pos.y}px`;
        minimap.style.transform = `rotate(${currentRotation}deg)`;
    }

    if (arrow) {
        let targetArrowRot = playerAngle + currentRotation;
        let diffArrow = targetArrowRot - currentArrowRotation;
        while (diffArrow < -180) diffArrow += 360;
        while (diffArrow > 180) diffArrow -= 360;
        currentArrowRotation += diffArrow * 0.15;
        arrow.style.transform = `translate(-50%, -50%) rotate(${currentArrowRotation}deg)`;
    }

    requestAnimationFrame(loopFluido);
}

// ============================================================
// RECEBIMENTO DE DADOS DO SERVIDOR (CEF)
// ============================================================
if (typeof cef !== 'undefined') {
    cef.on("updatePos", (x, y, angle) => {
        playerPosX = x;
        playerPosY = y;
        playerAngle = angle;
        if (mapLayer && mapLayer.style.display === 'block') renderizarBlipsNoMapa();
    });

    cef.on("updateHud", (money, bank) => {
        const hand = document.getElementById("money-hand");
        const bk = document.getElementById("money-bank");
        if (hand) hand.innerText = money.toLocaleString('pt-BR');
        if (bk) bk.innerText = bank.toLocaleString('pt-BR');
    });

    cef.on("browser:ready", () => {
        // Tenta esconder a HUD original em tempos diferentes para garantir que não volte
        hideOriginalHud();
        setTimeout(hideOriginalHud, 100);
        setTimeout(hideOriginalHud, 500);
        setTimeout(hideOriginalHud, 2000);
    });
}

function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        clockElement.innerText = String(now.getHours()).padStart(2, '0') + ":" + 
                                 String(now.getMinutes()).padStart(2, '0');
    }
}
setInterval(updateClock, 1000);
updateClock();
requestAnimationFrame(loopFluido);