// ============================================================
// CONFIGURAÇÕES DE ESCALA (MTA / GTA CORE)
// ============================================================
const MAP_SIZE = 6000; 
const IMG_SIZE = 2500; 
const SCALE = IMG_SIZE / MAP_SIZE;

let zoom = 1.0; 
let isDragging = false;
let startX, startY, mapX = 0, mapY = 0;

// Variáveis de Posição e Suavização
let playerPosX = 0;
let playerPosY = 0;
let playerAngle = 0;
let currentRotation = 0;      
let currentArrowRotation = 0; 

// Elementos do DOM
const mapLayer = document.getElementById('big-map-layer');
const mapContainer = document.getElementById('map-container');
const mapImg = document.getElementById('full-map-img');
const canvas = document.getElementById('map-canvas');
const hud = document.getElementById('main-hud');

// Blips com nomes para o novo sistema
const blipsFixos = [
    {id: 'hosp', x: 1242, y: -1694, icon: '🏥', nome: 'Hospital'},
    {id: 'police', x: 1543, y: -1675, icon: '🚔', nome: 'Delegacia'},
    {id: 'mecanic', x: -2024, y: 156, icon: '🔧', nome: 'Mecânica'}
];

// Conversor Global de Coordenadas
function gtaToPixels(x, y) {
    return { 
        x: (IMG_SIZE / 2) + (x * SCALE), 
        y: (IMG_SIZE / 2) - (y * SCALE) 
    };
}

// ============================================================
// FUNÇÕES DE GPS (SINCRONIZAÇÃO MAPA GRANDE + MINIMAPA)
// ============================================================

function gpsParaLocal(x, y, nome) {
    if (typeof cef !== 'undefined') {
        cef.emit("setGPS", x, y);
        console.log(`Traçando rota para: ${nome}`);
    }
}

/**
 * Desenha a linha roxa no SVG do Mapa Grande e do Minimapa simultaneamente.
 * Ela vai se modificando conforme o player anda se o servidor reenviar a rota atualizada.
 */
function atualizarLinhaGPS(pontosString) {
    const gpsPathGrande = document.getElementById('gps-path');
    const gpsPathMini = document.getElementById('gps-path-mini');
    
    if (!pontosString || pontosString === "") {
        if (gpsPathGrande) gpsPathGrande.setAttribute('points', "");
        if (gpsPathMini) gpsPathMini.setAttribute('points', "");
        return;
    }

    // Formato esperado: "x,y|x,y|x,y"
    const pontos = pontosString.split('|');
    let svgPoints = "";

    pontos.forEach(p => {
        const coord = p.split(',');
        if (coord.length === 2) {
            const pos = gtaToPixels(parseFloat(coord[0]), parseFloat(coord[1]));
            svgPoints += `${pos.x},${pos.y} `;
        }
    });

    if (gpsPathGrande) gpsPathGrande.setAttribute('points', svgPoints);
    if (gpsPathMini) gpsPathMini.setAttribute('points', svgPoints);
}

// ============================================================
// FUNÇÕES DE EXIBIÇÃO E RENDERIZAÇÃO
// ============================================================

function hideOriginalHud() {
    if (typeof cef !== 'undefined' && cef.emit) {
        cef.emit("game:hud:setComponentVisible", "interface", false);
        cef.emit("game:hud:setComponentVisible", "radar", false);
    }
}

function toggleMapa() {
    if (!mapLayer) return;
    const isVisible = mapLayer.style.display === 'block';
    
    if (!isVisible) {
        mapLayer.style.display = 'block';
        if (hud) hud.style.display = 'none';
        
        const pos = gtaToPixels(playerPosX, playerPosY);
        mapX = (window.innerWidth / 2) - (pos.x * zoom);
        mapY = (window.innerHeight / 2) - (pos.y * zoom);
        
        renderizarBlipsNoMapa();
    } else {
        mapLayer.style.display = 'none';
        if (hud) hud.style.display = 'block';
    }
}

function renderizarBlipsNoMapa() {
    if (!mapContainer || !canvas) return;
    
    // Move Imagem + SVG + Canvas juntos
    mapContainer.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
    
    canvas.innerHTML = ''; 

    blipsFixos.forEach(blip => {
        const pos = gtaToPixels(blip.x, blip.y);
        const div = document.createElement('div');
        div.className = 'blip-container';
        div.style.left = `${pos.x}px`;
        div.style.top = `${pos.y}px`;
        div.style.transform = `translate(-50%, -50%) scale(${1.1/zoom})`; 
        div.innerHTML = `<span style="font-size: 20px;">${blip.icon}</span>`;
        canvas.appendChild(div);
    });

    const pPos = gtaToPixels(playerPosX, playerPosY);
    const pDiv = document.createElement('div');
    pDiv.innerHTML = '▲'; 
    pDiv.style.position = 'absolute';
    pDiv.style.color = '#bf00ff'; 
    pDiv.style.fontSize = '22px';
    pDiv.style.left = `${pPos.x}px`;
    pDiv.style.top = `${pPos.y}px`;
    pDiv.style.transform = `translate(-50%, -50%) rotate(${-playerAngle}deg) scale(${1.2/zoom})`;
    canvas.appendChild(pDiv);
}

// ============================================================
// LOOPS E EVENTOS
// ============================================================

function loopFluido() {
    const minimap = document.getElementById("map-img");
    const gpsMini = document.getElementById("gps-svg-mini"); // SVG da rota no minimapa
    const arrow = document.querySelector(".player-arrow");
    const pos = gtaToPixels(playerPosX, playerPosY);

    if (minimap) {
        let targetRot = playerAngle; 
        let diff = targetRot - currentRotation;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        currentRotation += diff * 0.15; 

        // Rotaciona o mapa e a rota juntos no radar
        const transformCSS = `rotate(${currentRotation}deg)`;
        const originCSS = `${pos.x}px ${pos.y}px`;
        const leftTopCSS = {
            left: `calc(50% - ${pos.x}px)`,
            top: `calc(50% - ${pos.y}px)`
        };

        minimap.style.left = leftTopCSS.left;
        minimap.style.top = leftTopCSS.top;
        minimap.style.transformOrigin = originCSS;
        minimap.style.transform = transformCSS;

        if (gpsMini) {
            gpsMini.style.left = leftTopCSS.left;
            gpsMini.style.top = leftTopCSS.top;
            gpsMini.style.transformOrigin = originCSS;
            gpsMini.style.transform = transformCSS;
        }
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

// Eventos de Mouse e Teclado
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'm') toggleMapa();
    if (key === 'h') {
        if (typeof cef !== 'undefined') {
            if (mapLayer && mapLayer.style.display === 'block') toggleMapa();
            cef.emit("fecharFocoMapa"); 
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (mapLayer && mapLayer.style.display === 'block') {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const oldZoom = zoom;
        zoom = Math.min(Math.max(0.4, zoom + delta), 4.5);
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        mapX -= (mouseX - mapX) * (zoom / oldZoom - 1);
        mapY -= (mouseY - mapY) * (zoom / oldZoom - 1);
        renderizarBlipsNoMapa();
    }
}, { passive: false });

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
// RECEBIMENTO DE DADOS CEF
// ============================================================
if (typeof cef !== 'undefined') {
    cef.on("updatePos", (x, y, angle) => {
        playerPosX = x;
        playerPosY = y;
        playerAngle = angle;
        if (mapLayer && mapLayer.style.display === 'block') renderizarBlipsNoMapa();
    });

    cef.on("updateGPSPath", (pathData) => {
        atualizarLinhaGPS(pathData);
    });

    cef.on("updateHud", (money, bank) => {
        const hand = document.getElementById("money-hand");
        const bk = document.getElementById("money-bank");
        if (hand) hand.innerText = money.toLocaleString('pt-BR');
        if (bk) bk.innerText = bank.toLocaleString('pt-BR');
    });

    cef.on("browser:ready", () => {
        hideOriginalHud();
        setTimeout(hideOriginalHud, 100);
        setTimeout(hideOriginalHud, 2000);
    });
}

// Clock e Start
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