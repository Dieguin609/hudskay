// ============================================================
// CONFIGURAÇÕES DE ESCALA E VARIÁVEIS GLOBAIS
// ============================================================
const MAP_SIZE = 6000; 
const IMG_SIZE = 2500; 
const SCALE = IMG_SIZE / MAP_SIZE;

let zoom = 1.0; 
let isDragging = false;
let startX, startY, mapX = 0, mapY = 0;

const mapLayer = document.getElementById('big-map-layer');
const mapImg = document.getElementById('full-map-img');
const hud = document.getElementById('main-hud');

// Conversor de Coordenadas (GTA -> Pixels)
function gtaToPixels(x, y) {
    return { 
        x: (IMG_SIZE / 2) + (x * SCALE), 
        y: (IMG_SIZE / 2) - (y * SCALE) 
    };
}

// ============================================================
// LÓGICA DE ABRIR/FECHAR MAPA E CONTROLE DE FOCO
// ============================================================
function toggleMapa() {
    // Verifica se o mapa está escondido
    const estaFechado = (mapLayer.style.display === 'none' || mapLayer.style.display === '');
    
    if (estaFechado) {
        // ABRIR MAPA
        mapLayer.style.display = 'block';
        hud.style.display = 'none'; // Esconde a HUD principal
        
        // Solicita ao jogo para liberar o mouse e focar no site
        if (typeof cef !== 'undefined') {
            cef.emit("setFocus", true);
        }

        // Centraliza o mapa na tela ao abrir
        mapX = (window.innerWidth / 2) - (IMG_SIZE / 2);
        mapY = (window.innerHeight / 2) - (IMG_SIZE / 2);
        mapImg.style.left = mapX + 'px';
        mapImg.style.top = mapY + 'px';
    } else {
        // FECHAR MAPA
        mapLayer.style.display = 'none';
        hud.style.display = 'block'; // Mostra a HUD principal de volta
        
        // Solicita ao jogo para devolver o foco para o teclado/mouse do personagem
        if (typeof cef !== 'undefined') {
            cef.emit("setFocus", false);
        }
    }
}

// Evento de tecla para o "H"
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
        toggleMapa();
    }
});

// ============================================================
// MOVIMENTAÇÃO DO MAPA (ARRASTAR)
// ============================================================
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
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// ============================================================
// INTEGRAÇÃO CEF (DINHEIRO, BANCO E RADAR)
// ============================================================
if (typeof cef !== 'undefined') {
    // Atualiza Dinheiro e Banco (Não ignorado!)
    cef.on("updateHud", (money, bank) => {
        const handEl = document.getElementById("money-hand");
        const bankEl = document.getElementById("money-bank");
        if (handEl) handEl.innerText = money.toLocaleString('pt-BR');
        if (bankEl) bankEl.innerText = bank.toLocaleString('pt-BR');
    });

    // Atualiza Posição no Minimapa (Radar Circular)
    cef.on("updatePos", (x, y, angle) => {
        const minimap = document.getElementById("map-img");
        const arrow = document.querySelector(".player-arrow");
        const pos = gtaToPixels(x, y);

        if (minimap) {
            // 85px é o centro do radar definido no seu CSS
            minimap.style.left = `calc(85px - ${pos.x}px)`;
            minimap.style.top = `calc(85px - ${pos.y}px)`;
        }
        if (arrow) {
            arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        }
    });
}

// ============================================================
// RELÓGIO (Sempre ativo)
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
