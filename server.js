const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile('./index.html', (err, content) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

// Mantener registro de usuarios conectados
const connectedUsers = new Map();

wss.on('connection', (ws) => {
    console.log('🟢 Nuevo cliente conectado');
    let userId = null;
    
    ws.on('message', (message) => {
        console.log('📨 Mensaje recibido del cliente:', message.toString());
        
        try {
            const messageData = JSON.parse(message.toString());
            
            // Registrar ID de usuario si es información de usuario
            if (messageData.type === 'user-info') {
                userId = messageData.userId;
                connectedUsers.set(userId, { ws, username: messageData.username });
                console.log(`👤 Usuario registrado: ${messageData.username} (${userId})`);
            }
            
            // Reenviar mensaje a todos los clientes conectados
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());
                    console.log('📤 Mensaje reenviado a cliente');
                }
            });
        } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔴 Cliente desconectado');
        if (userId) {
            connectedUsers.delete(userId);
            console.log(`👤 Usuario desconectado: ${userId}`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Error en conexión WebSocket:', error);
        if (userId) {
            connectedUsers.delete(userId);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log('📡 Servidor WebSocket escuchando en el mismo puerto');
});
