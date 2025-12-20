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
const mapContainer = document.getElementById('map-container'); // O NOVO PAI
const mapImg = document.getElementById('full-map-img');
const canvas = document.getElementById('map-canvas');
const gpsPath = document.getElementById('gps-path'); // A LINHA ROXA
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
// FUNÇÕES DE GPS E INTERFACE
// ============================================================

// Função chamada pelos botões do menu lateral
function gpsParaLocal(x, y, nome) {
    if (typeof cef !== 'undefined') {
        // Emite para o Pawn calcular a rota
        cef.emit("setGPS", x, y);
        console.log(`Traçando rota para: ${nome}`);
    }
}

// Desenha a linha roxa no SVG
function atualizarLinhaGPS(pontosString) {
    if (!gpsPath) return;
    if (!pontosString || pontosString === "") {
        gpsPath.setAttribute('points', "");
        return;
    }

    // Formato esperado: "x,y|x,y|x,y"
    const pontos = pontosString.split('|');
    let svgPoints = "";

    pontos.forEach(p => {
        const coord = p.split(',');
        const pos = gtaToPixels(parseFloat(coord[0]), parseFloat(coord[1]));
        svgPoints += `${pos.x},${pos.y} `;
    });

    gpsPath.setAttribute('points', svgPoints);
}

// ============================================================
// FUNÇÕES DE EXIBIÇÃO
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

// ============================================================
// EVENTOS DE CONTROLE (TECLAS E MOUSE)
// ============================================================
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
// RENDERIZAÇÃO
// ============================================================

function renderizarBlipsNoMapa() {
    if (!mapContainer || !canvas) return;
    
    // Aplica a transformação no CONTAINER (Move Imagem + SVG + Canvas juntos)
    mapContainer.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
    
    canvas.innerHTML = ''; 

    blipsFixos.forEach(blip => {
        const pos = gtaToPixels(blip.x, blip.y);
        const div = document.createElement('div');
        div.className = 'blip-container';
        div.style.left = `${pos.x}px`;
        div.style.top = `${pos.y}px`;
        // Escala inversa para o ícone não sumir no zoom
        div.style.transform = `translate(-50%, -50%) scale(${1.1/zoom})`; 
        div.innerHTML = `<span style="font-size: 20px;">${blip.icon}</span>`;
        canvas.appendChild(div);
    });

    const pPos = gtaToPixels(playerPosX, playerPosY);
    const pDiv = document.createElement('div');
    pDiv.innerHTML = '▲'; 
    pDiv.style.position = 'absolute';
    pDiv.style.color = '#bf00ff'; // Seta roxa no mapa grande para combinar
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
        let targetRot = playerAngle; 
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
// RECEBIMENTO DE DADOS CEF
// ============================================================
if (typeof cef !== 'undefined') {
    cef.on("updatePos", (x, y, angle) => {
        playerPosX = x;
        playerPosY = y;
        playerAngle = angle;
        if (mapLayer && mapLayer.style.display === 'block') renderizarBlipsNoMapa();
    });

    // ESCUTA PARA ATUALIZAR A LINHA DO GPS (Vindo do Pawn)
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

// Clock e Loop
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