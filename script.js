function selecionarSpawn(id) {
    // Comunicação direta com o servidor
    if (typeof cef !== 'undefined') {
        cef.emit("server:selecionarSpawn", id);
    } else {
        console.log("Local selecionado: " + id);
    }
}