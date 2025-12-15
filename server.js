// ====================================================================
// GLOOM-CHAT: EL ANFITRIÓN DEL SERVIDOR (FINAL)
// ====================================================================

// --- 1. PRESENTANDO LAS HERRAMIENTAS ---
const express = require('express');         
const http = require('http');               
const { Server } = require('socket.io');    

// --- 2. CONFIGURACIÓN DEL SALÓN DE EVENTOS ---

// CORRECCIÓN DE PUERTO: Usamos SOLO la variable de entorno de Render.
const PORT = process.env.PORT; 

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
let invitadosActivos = {};        
let historialDeConversacion = []; 
const LIMITE_DE_HISTORIAL = 30; 

// --- 4. LA RECEPCIÓN DEL SERVIDOR (Rutas Web) ---

// Esto sirve todos los archivos dentro de la carpeta 'public/' (CSS, JS, imágenes, etc.)
app.use(express.static('public')); 

app.get('/', (req, res) => {
    // RUTA ESTÁNDAR: El index.html está dentro de la carpeta 'public'
    res.sendFile(__dirname + '/public/index.html'); 
});

// --- 5. LÓGICA DE LA FIESTA (Manejando Conexiones de Socket.IO) ---
// (Tu lógica de chat y conexión aquí...)
io.on('connection', (socket) => {
    console.log(`[CONEXIÓN] Un nuevo cliente ha entrado al salón: ${socket.id}`);

    // [Lógica user-ready]
    socket.on('user-ready', (datosInvitado) => {
        const { userId, nickname } = datosInvitado;
        
        if (invitadosActivos[userId]) {
            delete invitadosActivos[invitadosActivos[userId].socketId]; 
        }

        invitadosActivos[userId] = { 
            socketId: socket.id, 
            nickname: nickname,
            userId: userId
        };
        
        io.emit('user-join', nickname); 
        io.emit('active-users', Object.keys(invitadosActivos).length);
        socket.emit('history', historialDeConversacion); 
    });

    // [Lógica send-message]
    socket.on('send-message', (textoDelMensaje) => {
        const remitente = Object.values(invitadosActivos).find(u => u.socketId === socket.id);
        if (!remitente || !textoDelMensaje) return; 

        const mensajeCompleto = { /* ... */ };
        historialDeConversacion.push(mensajeCompleto);
        
        if (historialDeConversacion.length > LIMITE_DE_HISTORIAL) {
            historialDeConversacion.shift(); 
        }
        
        io.emit('chat-message', mensajeCompleto);
    });

    // [Lógica disconnect]
    socket.on('disconnect', () => {
        const invitadoQueSeFue = Object.values(invitadosActivos).find(u => u.socketId === socket.id);
        if (invitadoQueSeFue) {
            delete invitadosActivos[invitadoQueSeFue.userId]; 
            io.emit('user-leave', invitadoQueSeFue.nickname);
            io.emit('active-users', Object.keys(invitadosActivos).length);
            console.log(`[DESCONEXIÓN] Invitado retirado: ${invitadoQueSeFue.nickname}`);
        }
    });
});

// --- 6. APERTURA OFICIAL DEL SALÓN ---
server.listen(PORT, () => {
    console.log(`🚀 El Anfitrión ha iniciado Gloom-Chat (30 Mensajes en RAM) en el puerto ${PORT}`);
});
