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

// Almacenamiento de mensajes y usuarios
const messages = []; // Almacenar todos los mensajes
const connectedClients = new Set();

wss.on('connection', (ws) => {
    console.log('🟢 Nuevo cliente conectado');
    connectedClients.add(ws);
    
    ws.on('message', (message) => {
        console.log('📨 Mensaje recibido del cliente:', message.toString());
        
        try {
            const messageData = JSON.parse(message.toString());
            
            switch (messageData.type) {
                case 'request-historical':
                    // Enviar mensajes históricos al nuevo cliente
                    ws.send(JSON.stringify({
                        type: 'historical-messages',
                        messages: messages
                    }));
                    break;
                    
                case 'user-info':
                    // No necesitamos hacer nada especial
                    break;
                    
                case 'typing':
                case 'stop-typing':
                case 'read-receipt':
                    // Reenviar estos mensajes a todos los clientes
                    broadcastMessage(message.toString(), ws);
                    break;
                    
                case 'text':
                case 'image':
                    // Almacenar mensaje y reenviar
                    messages.push(messageData);
                    broadcastMessage(message.toString(), ws);
                    break;
                    
                default:
                    // Reenviar cualquier otro mensaje
                    broadcastMessage(message.toString(), ws);
            }
        } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔴 Cliente desconectado');
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ Error en conexión WebSocket:', error);
        connectedClients.delete(ws);
    });
});

function broadcastMessage(message, sender) {
    connectedClients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log('📤 Mensaje reenviado a cliente');
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log('📡 Servidor WebSocket escuchando en el mismo puerto');
});
