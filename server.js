// ====================================================================
// GLOOM-CHAT: EL ANFITRIÓN DEL SERVIDOR
// Este código maneja el servidor web y la comunicación en tiempo real.
// ====================================================================

// --- 1. PRESENTANDO LAS HERRAMIENTAS (Las Dependencias) ---
const express = require('express');         // Express: Nuestro marco para construir el edificio (servidor HTTP).
const http = require('http');               // HTTP: Necesario para que Express y Socket.IO convivan.
const { Server } = require('socket.io');    // Socket.IO: Nuestro servicio de mensajería rápida (tiempo real).

// --- 2. CONFIGURACIÓN DEL SALÓN DE EVENTOS ---
// Render nos da el número de puerto para el salón, sino usamos el 3000 localmente.
const PORT = process.env.PORT || 3000;

const app = express(); // Creamos la aplicación Express.
const server = http.createServer(app); // Creamos el servidor HTTP que Express usará.

// Configuramos Socket.IO para que acepte invitados de cualquier lugar (CORS)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- 3. ALMACENAMIENTO DE RECUERDOS (Memoria No Persistente) ---
// Estos datos se pierden si el servidor se reinicia.
let invitadosActivos = {};        // Guardamos quién está en el chat por su ID de usuario.
let historialDeConversacion = []; // El registro de los últimos mensajes.

const LIMITE_DE_HISTORIAL = 50; // Solo recordamos los últimos 50 mensajes.

// --- 4. LA RECEPCIÓN DEL SERVIDOR (Rutas Web) ---
// Cuando alguien visita la URL principal (ej: Render), les entregamos la página principal.
app.use(express.static('public')); // Permite servir archivos (CSS, JS) desde la carpeta 'public'.

app.get('/', (req, res) => {
    // Les mostramos la interfaz del chat.
    res.sendFile(__dirname + '/public/index.html');
});

// --- 5. LÓGICA DE LA FIESTA (Manejando Conexiones de Socket.IO) ---
// Cuando un invitado (cliente) se conecta, inicia un 'socket' (una línea directa).
io.on('connection', (socket) => {
    console.log(`[CONEXIÓN] Un nuevo cliente ha entrado al salón: ${socket.id}`);

    // --- A. EL INVITADO SE PRESENTA ('user-ready') ---
    // Cuando el invitado nos da su nombre y ID.
    socket.on('user-ready', (datosInvitado) => {
        const { userId, nickname } = datosInvitado;
        
        // Registrar o actualizar al invitado en nuestra lista
        if (invitadosActivos[userId]) {
            // Si ya estaba aquí, actualizamos su línea directa (socket ID)
            delete invitadosActivos[invitadosActivos[userId].socketId]; 
        }

        invitadosActivos[userId] = { 
            socketId: socket.id, 
            nickname: nickname,
            userId: userId
        };
        
        // 1. ANUNCIO GLOBAL: Avisamos a todos los demás invitados.
        io.emit('user-join', nickname); 
        io.emit('active-users', Object.keys(invitadosActivos).length); // Actualizamos el contador.

        // 2. ENTREGA DEL REGISTRO: Le mostramos el historial de la conversación.
        socket.emit('history', historialDeConversacion); 
    });

    // --- B. UN INVITADO ENVÍA UN MENSAJE ('send-message') ---
    socket.on('send-message', (textoDelMensaje) => {
        // Encontramos quién está hablando basándonos en su línea directa (socket.id)
        const remitente = Object.values(invitadosActivos).find(u => u.socketId === socket.id);

        if (!remitente || !textoDelMensaje) return; // Si no lo conocemos o el mensaje está vacío, lo ignoramos.

        const mensajeCompleto = {
            nickname: remitente.nickname,
            userId: remitente.userId,
            message: textoDelMensaje,
            timestamp: Date.now()
        };
        
        // 1. GUARDAR EN MEMORIA: Añadimos el mensaje a nuestros recuerdos temporales.
        historialDeConversacion.push(mensajeCompleto);
        
        // Mantenemos el orden y el límite para que no se sobrecargue.
        if (historialDeConversacion.length > LIMITE_DE_HISTORIAL) {
            historialDeConversacion.shift(); // Desechamos el mensaje más antiguo.
        }
        
        // 2. DIFUSIÓN: Enviamos el mensaje a TODOS los invitados en el salón.
        io.emit('chat-message', mensajeCompleto);
    });

    // --- C. EL INVITADO SE VA ('disconnect') ---
    socket.on('disconnect', () => {
        // Encontramos al invitado que acaba de cerrar su línea.
        const invitadoQueSeFue = Object.values(invitadosActivos).find(u => u.socketId === socket.id);
        
        if (invitadoQueSeFue) {
            delete invitadosActivos[invitadoQueSeFue.userId]; // Lo eliminamos de la lista.
            
            // ANUNCIO GLOBAL: Avisamos a todos que se retiró.
            io.emit('user-leave', invitadoQueSeFue.nickname);
            io.emit('active-users', Object.keys(invitadosActivos).length); // Actualizamos el contador.
            console.log(`[DESCONEXIÓN] Invitado retirado: ${invitadoQueSeFue.nickname}`);
        } else {
            console.log(`[DESCONEXIÓN] Cliente desconocido cerró conexión: ${socket.id}`);
        }
    });
});

// --- 6. APERTURA OFICIAL DEL SALÓN ---
server.listen(PORT, () => {
    console.log(`El Anfitrión ha iniciado Gloom-Chat en el puerto ${PORT}`);
});
