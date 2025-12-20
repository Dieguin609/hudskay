/**
 * ============================================================
 * SKYPIXEL RPG - SCRIPT CORE (HUD + MAPA + GPS)
 * ============================================================
 * * Este arquivo contém:
 * 1. Sistema de Escala e Conversão (GTA -> Pixels)
 * 2. Lógica de Ocultar HUD Original do GTA
 * 3. Gerenciamento de Dinheiro, Banco e Relógio
 * 4. Mapa Interativo (Zoom, Arraste, ContextMenu)
 * 5. GPS Sincronizado (Minimapa + Mapa Grande)
 * 6. Loop de Renderização Fluida (60 FPS)
 */

// ============================================================
// CONFIGURAÇÕES DE ESCALA E VARIÁVEIS GERAIS
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

// Blips Fixos (Base do Servidor)
const blipsFixos = [
    {id: 'hosp', x: 1242, y: -1694, icon: '🏥', nome: 'Hospital'},
    {id: 'police', x: 1543, y: -1675, icon: '🚔', nome: 'Delegacia'},
    {id: 'mecanic', x: -2024, y: 156, icon: '🔧', nome: 'Mecânica'},
    {id: 'pizzaria', x: 2100, y: -1800, icon: '🍕', nome: 'Pizzaria'},
    {id: 'prefeitura', x: 1481, y: -1750, icon: '🏛️', nome: 'Prefeitura'}
];

/**
 * Converte coordenadas do GTA (Float) para Pixels da Imagem (0-2500)
 */
function gtaToPixels(x, y) {
    return { 
        x: (IMG_SIZE / 2) + (x * SCALE), 
        y: (IMG_SIZE / 2) - (y * SCALE) 
    };
}

// ============================================================
// FUNÇÕES DE INTERFACE (HUD ORIGINAL)
// ============================================================

/**
 * Força a ocultação dos componentes originais do GTA
 */
// ============================================================
// FUNÇÕES DE EXIBIÇÃO
// ============================================================
function hideOriginalHud() {
    if (typeof cef !== 'undefined' && cef.emit) {
        cef.emit("game:hud:setComponentVisible", "interface", false);
        cef.emit("game:hud:setComponentVisible", "radar", false);
    }
}

/**
 * Atualiza o Relógio da HUD
 */
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockElement.innerText = `${hours}:${minutes}`;
    }
}

// ============================================================
// SISTEMA DE GPS (MINIMAPA + MAPA GRANDE)
// ============================================================

/**
 * Envia comando para o Pawn iniciar o cálculo de rota
 */
function gpsParaLocal(x, y, nome) {
    if (typeof cef !== 'undefined') {
        cef.emit("setGPS", x, y);
        console.log(`[GPS] Destino definido: ${nome || "Marcado no Mapa"}`);
    }
}

/**
 * Desenha a linha nos SVGs baseada na string enviada pelo Pawn
 * Formato: "x,y|x,y|x,y"
 */
function atualizarLinhaGPS(pontosString) {
    const gpsPathGrande = document.getElementById('gps-path');
    const gpsPathMini = document.getElementById('gps-path-mini');
    
    if (!pontosString || pontosString === "" || pontosString === "0") {
        if (gpsPathGrande) gpsPathGrande.setAttribute('points', "");
        if (gpsPathMini) gpsPathMini.setAttribute('points', "");
        return;
    }

    const pontos = pontosString.split('|');
    let svgPoints = "";

    pontos.forEach(p => {
        const coord = p.split(',');
        if (coord.length === 2) {
            const pos = gtaToPixels(parseFloat(coord[0]), parseFloat(coord[1]));
            svgPoints += `${pos.x},${pos.y} `;
        }
    });

    if (gpsPathGrande) {
        gpsPathGrande.setAttribute('points', svgPoints);
        gpsPathGrande.setAttribute('stroke-width', "8"); // Espessura Mapa Aberto
    }
    if (gpsPathMini) {
        gpsPathMini.setAttribute('points', svgPoints);
        // REDUÇÃO AQUI: Valor menor para a linha não ficar gigante no minimapa
        gpsPathMini.setAttribute('stroke-width', "3.5"); 
    }
}

// ============================================================
// GERENCIAMENTO DO MAPA GRANDE (MENU INTERATIVO)
// ============================================================

/**
 * Abre e fecha o Mapa Grande (Tecla M)
 */
function toggleMapa() {
    if (!mapLayer) return;
    const isVisible = mapLayer.style.display === 'block';
    
    if (!isVisible) {
        mapLayer.style.display = 'block';
        if (hud) hud.style.display = 'none';
        
        // Foca o mapa na posição atual do jogador ao abrir
        const pos = gtaToPixels(playerPosX, playerPosY);
        mapX = (window.innerWidth / 2) - (pos.x * zoom);
        mapY = (window.innerHeight / 2) - (pos.y * zoom);
        
        renderizarBlipsNoMapa();
        
        // Ativa cursor no CEF
        if (typeof cef !== 'undefined') cef.emit("toggleCursor", true);
    } else {
        mapLayer.style.display = 'none';
        if (hud) hud.style.display = 'block';
        
        // Desativa cursor no CEF
        if (typeof cef !== 'undefined') {
            cef.emit("toggleCursor", false);
            cef.emit("fecharFocoMapa");
        }
    }
}

/**
 * Renderiza Ícones e Player no Canvas do Mapa Grande
 */
function renderizarBlipsNoMapa() {
    if (!mapContainer || !canvas) return;
    
    // Move todo o container (Imagem + Rota + Blips)
    mapContainer.style.transform = `translate(${mapX}px, ${mapY}px) scale(${zoom})`;
    
    canvas.innerHTML = ''; 

    // Blips Estáticos
    blipsFixos.forEach(blip => {
        const pos = gtaToPixels(blip.x, blip.y);
        const div = document.createElement('div');
        div.className = 'blip-container';
        div.style.left = `${pos.x}px`;
        div.style.top = `${pos.y}px`;
        // Ajusta escala invertida do zoom para o ícone não sumir
        div.style.transform = `translate(-50%, -50%) scale(${1.1/zoom})`; 
        div.innerHTML = `<span style="font-size: 20px;">${blip.icon}</span>`;
        
        // Clique no blip também marca GPS
        div.onclick = () => gpsParaLocal(blip.x, blip.y, blip.nome);
        
        canvas.appendChild(div);
    });

    // Ícone do Jogador no Mapa Grande
    const pPos = gtaToPixels(playerPosX, playerPosY);
    const pDiv = document.createElement('div');
    pDiv.innerHTML = '▲'; 
    pDiv.style.position = 'absolute';
    pDiv.style.color = '#bf00ff'; 
    pDiv.style.fontSize = '22px';
    pDiv.style.left = `${pPos.x}px`;
    pDiv.style.top = `${pPos.y}px`;
    // Gira a seta do player de acordo com o ângulo do jogo
    pDiv.style.transform = `translate(-50%, -50%) rotate(${-playerAngle}deg) scale(${1.2/zoom})`;
    canvas.appendChild(pDiv);
}

// ============================================================
// LOOP DE ATUALIZAÇÃO (60 FPS)
// ============================================================

function loopFluido() {
    const minimapImg = document.getElementById("map-img");
    const gpsMiniSVG = document.getElementById("gps-svg-mini");
    const arrow = document.querySelector(".player-arrow");
    const pos = gtaToPixels(playerPosX, playerPosY);

    if (minimapImg) {
        // Suavização da rotação do radar (Efeito Inércia)
        let targetRot = playerAngle; 
        let diff = targetRot - currentRotation;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        currentRotation += diff * 0.15; 

        const transformCSS = `rotate(${currentRotation}deg)`;
        const originCSS = `${pos.x}px ${pos.y}px`;
        
        // Posicionamento centralizado no jogador
        const offsetCSS = {
            left: `calc(50% - ${pos.x}px)`,
            top: `calc(50% - ${pos.y}px)`
        };

        // Aplica transformações na imagem do mapa
        minimapImg.style.left = offsetCSS.left;
        minimapImg.style.top = offsetCSS.top;
        minimapImg.style.transformOrigin = originCSS;
        minimapImg.style.transform = transformCSS;

        // Sincroniza a camada do GPS no Minimapa
        if (gpsMiniSVG) {
            gpsMiniSVG.style.left = offsetCSS.left;
            gpsMiniSVG.style.top = offsetCSS.top;
            gpsMiniSVG.style.transformOrigin = originCSS;
            gpsMiniSVG.style.transform = transformCSS;
        }
    }

    if (arrow) {
        /**
         * CORREÇÃO DA SETA:
         * No GTA, o mapa gira e a seta fica parada apontando para cima.
         * Se o mapa rotaciona 45 graus, a seta deve compensar para manter a direção real.
         */
        arrow.style.transform = `translate(-50%, -50%) rotate(0deg)`; 
    }

    requestAnimationFrame(loopFluido);
}

// ============================================================
// CONTROLES DE MOUSE E TECLADO
// ============================================================

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'm') toggleMapa();
    
    // Tecla H para fechar e limpar foco (Padrão do servidor)
    if (key === 'h') {
        if (mapLayer && mapLayer.style.display === 'block') toggleMapa();
        if (typeof cef !== 'undefined') cef.emit("fecharFocoMapa");
    }
});

// Zoom do Mapa (Scroll)
window.addEventListener('wheel', (e) => {
    if (mapLayer && mapLayer.style.display === 'block') {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const oldZoom = zoom;
        zoom = Math.min(Math.max(0.4, zoom + delta), 4.5);
        
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        mapX -= (mouseX - mapX) * (zoom / oldZoom - 1);
        mapY -= (mouseY - mapY) * (zoom / oldZoom - 1);
        
        renderizarBlipsNoMapa();
    }
}, { passive: false });

// Sistema de Arrastar o Mapa
if (mapLayer) {
    mapLayer.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Botão Esquerdo
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
        if (mapLayer) mapLayer.style.cursor = 'default';
    });
}

// Botão Direito para Marcar Destino no Mapa
mapLayer?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (mapLayer.style.display !== 'block') return;

    const rect = mapImg.getBoundingClientRect();
    
    // Calcula posição exata ignorando zoom e offset de arraste
    const pxX = (e.clientX - rect.left) / zoom;
    const pxY = (e.clientY - rect.top) / zoom;
    
    const gtaX = (pxX - (IMG_SIZE / 2)) / SCALE;
    const gtaY = ((IMG_SIZE / 2) - pxY) / SCALE;

    gpsParaLocal(gtaX, gtaY, "Destino Marcado");
});

// ============================================================
// COMUNICAÇÃO CEF (PAWN -> JAVASCRIPT)
// ============================================================

if (typeof cef !== 'undefined') {
    
    // Atualiza Posição e Ângulo vindo do Servidor
    cef.on("updatePos", (x, y, angle) => {
        playerPosX = x;
        playerPosY = y;
        playerAngle = angle; 
        
        // Se o mapa estiver aberto, atualiza os blips em tempo real
        if (mapLayer && mapLayer.style.display === 'block') renderizarBlipsNoMapa();
    });

    // Recebe os pontos da rota calculada pelo plugin GPS
    cef.on("updateGPSPath", (pathData) => {
        atualizarLinhaGPS(pathData);
    });

    // Atualiza Dinheiro e Banco na HUD
    cef.on("updateHud", (money, bank) => {
        const hand = document.getElementById("money-hand");
        const bk = document.getElementById("money-bank");
        if (hand) hand.innerText = money.toLocaleString('pt-BR');
        if (bk) bk.innerText = bank.toLocaleString('pt-BR');
    });

    // Quando o Browser termina de carregar
    cef.on("browser:ready", () => {
        console.log("[CEF] Interface SkyPixel carregada com sucesso.");
        hideOriginalHud();
        // Chamadas de reforço para garantir que o radar sumiu
        setTimeout(hideOriginalHud, 500);
        setTimeout(hideOriginalHud, 2000);
        setTimeout(hideOriginalHud, 5000);
    });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

setInterval(updateClock, 1000);
updateClock();

// Inicia o Loop de Renderização
requestAnimationFrame(loopFluido);

console.log("[SkyPixel] Script Inicializado.");