// ====================================================================
// GLOOM-CHAT: EL ANFITRIÓN DEL SERVIDOR
// Este código maneja el servidor web y la comunicación en tiempo real.
// ====================================================================

// --- 1. PRESENTANDO LAS HERRAMIENTAS (Las Dependencias) ---
const express = require('express');         // Express: Nuestro marco para construir el edificio (servidor HTTP).
const http = require('http');               // HTTP: Necesario para que Express y Socket.IO convivan.
const { Server } = require('socket.io');    // Socket.IO: Nuestro servicio de mensajería rápida (tiempo real).

// --- 2. CONFIGURACIÓN DEL SALÓN DE EVENTOS ---
const PORT = process.env.PORT || 3000;

const app = express(); 
const server = http.createServer(app); 

// Configuramos Socket.IO para que acepte invitados de cualquier lugar (CORS)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- 3. ALMACENAMIENTO DE RECUERDOS (Memoria No Persistente) ---
let invitadosActivos = {};        // Guardamos quién está en el chat por su ID de usuario.
let historialDeConversacion = []; // El registro de los mensajes en la RAM.

// ¡NUEVA REGLA! Solo recordamos los últimos 30 mensajes.
const LIMITE_DE_HISTORIAL = 30; 

// --- 4. LA RECEPCIÓN DEL SERVIDOR (Rutas Web) ---
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// --- 5. LÓGICA DE LA FIESTA (Manejando Conexiones de Socket.IO) ---
io.on('connection', (socket) => {
    console.log(`[CONEXIÓN] Un nuevo cliente ha entrado al salón: ${socket.id}`);

    // --- A. EL INVITADO SE PRESENTA ('user-ready') ---
    socket.on('user-ready', (datosInvitado) => {
        const { userId, nickname } = datosInvitado;
        
        // ... (Lógica de registro de usuario) ...
        if (invitadosActivos[userId]) {
            delete invitadosActivos[invitadosActivos[userId].socketId]; 
        }

        invitadosActivos[userId] = { 
            socketId: socket.id, 
            nickname: nickname,
            userId: userId
        };
        
        // 1. ANUNCIO GLOBAL
        io.emit('user-join', nickname); 
        io.emit('active-users', Object.keys(invitadosActivos).length);

        // 2. ENTREGA DEL REGISTRO: Le mostramos el historial de la conversación.
        socket.emit('history', historialDeConversacion); 
    });

    // --- B. UN INVITADO ENVÍA UN MENSAJE ('send-message') ---
    socket.on('send-message', (textoDelMensaje) => {
        const remitente = Object.values(invitadosActivos).find(u => u.socketId === socket.id);

        if (!remitente || !textoDelMensaje) return; 

        const mensajeCompleto = {
            nickname: remitente.nickname,
            userId: remitente.userId,
            message: textoDelMensaje,
            timestamp: Date.now()
        };
        
        // 1. GUARDAR EN MEMORIA
        historialDeConversacion.push(mensajeCompleto);
        
        // ⚠️ CÓDIGO CLAVE: Mantenemos el límite de 30 mensajes.
        if (historialDeConversacion.length > LIMITE_DE_HISTORIAL) {
            historialDeConversacion.shift(); // Desechamos el mensaje más antiguo de la lista.
        }
        
        // 2. DIFUSIÓN: Enviamos el mensaje a TODOS.
        io.emit('chat-message', mensajeCompleto);
    });

    // --- C. EL INVITADO SE VA ('disconnect') ---
    socket.on('disconnect', () => {
        const invitadoQueSeFue = Object.values(invitadosActivos).find(u => u.socketId === socket.id);
        
        if (invitadoQueSeFue) {
            delete invitadosActivos[invitadoQueSeFue.userId]; 
            
            io.emit('user-leave', invitadoQueSeFue.nickname);
            io.emit('active-users', Object.keys(invitadosActivos).length);
            console.log(`[DESCONEXIÓN] Invitado retirado: ${invitadoQueSeFue.nickname}`);
        } else {
            console.log(`[DESCONEXIÓN] Cliente desconocido cerró conexión: ${socket.id}`);
        }
    });
});

// --- 6. APERTURA OFICIAL DEL SALÓN ---
server.listen(PORT, () => {
    console.log(`🚀 El Anfitrión ha iniciado Gloom-Chat (30 Mensajes en RAM) en el puerto ${PORT}`);
});
