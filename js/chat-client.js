class ChatClient {
    constructor() {
        this.username = this.generateUsername();
        this.socket = null;
        this.isConnected = false;
        this.messageTimers = new Map();
        this.sentMessageIds = new Set(); // Para evitar duplicados
        this.pendingImage = null; // Para almacenar imagen pendiente de envío
        
        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.sendButton = document.getElementById('sendButton');
        this.imageInput = document.getElementById('imageInput');
    }

    generateUsername() {
        const adjectives = ['Rápido', 'Feliz', 'Listo', 'Genial', 'Único', 'Activo', 'Creativo', 'Dinámico'];
        const nouns = ['Usuario', 'Chat', 'Mensaje', 'Red', 'Local', 'Grupo', 'Equipo', 'Comunidad'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${adj}${noun}${num}`;
    }

    initializeSocket() {
        // Conectar al servidor WebSocket
        const serverIP = window.location.hostname;
        const serverPort = 3000;
        
        try {
            this.socket = new WebSocket(`ws://${serverIP}:${serverPort}`);
            this.setupWebSocketEvents();
        } catch (error) {
            console.error('Error al conectar al WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    setupWebSocketEvents() {
        this.socket.onopen = () => {
            console.log('✅ Conectado al servidor WebSocket');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.enableInputs();
        };

        this.socket.onmessage = (event) => {
            try {
                console.log('📥 Mensaje recibido del servidor:', event.data);
                const messageData = JSON.parse(event.data);
                
                // Verificar si ya mostramos este mensaje (para evitar duplicados)
                if (this.sentMessageIds.has(messageData.id)) {
                    console.log('🔄 Mensaje ya mostrado, ignorando duplicado');
                    this.sentMessageIds.delete(messageData.id); // Limpiar el ID
                    return;
                }
                
                // Determinar si es un mensaje propio
                const isOwnMessage = messageData.username === this.username;
                messageData.isOwn = isOwnMessage;
                
                this.displayMessage(messageData);
            } catch (error) {
                console.error('❌ Error al procesar mensaje:', error);
            }
        };

        this.socket.onclose = () => {
            console.log('🔌 Desconectado del servidor WebSocket');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.disableInputs();
            
            // Intentar reconectar después de 3 segundos
            setTimeout(() => {
                this.initializeSocket();
            }, 3000);
        };

        this.socket.onerror = (error) => {
            console.error('❌ Error de WebSocket:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.disableInputs();
        };
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Evento para seleccionar imagen
        this.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageSelection(file);
            }
        });
    }

    handleImageSelection(file) {
        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona solo archivos de imagen');
            this.imageInput.value = '';
            return;
        }
        
        // Validar tamaño (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es muy grande. Máximo 5MB');
            this.imageInput.value = '';
            return;
        }
        
        // Convertir imagen a base64
        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingImage = e.target.result;
            this.sendButton.textContent = '📷 Enviar Imagen';
            this.sendButton.style.background = 'linear-gradient(135deg, #9b59b6, #8e44ad)';
        };
        reader.readAsDataURL(file);
    }

    sendMessage() {
        const textMessage = this.messageInput.value.trim();
        
        // Enviar mensaje de texto
        if (textMessage && this.isConnected) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // ID único
                username: this.username,
                content: textMessage,
                timestamp: new Date().toISOString(),
                type: 'text'
            };
            
            console.log('📤 Enviando mensaje de texto:', messageData);
            
            // Registrar que enviamos este mensaje
            this.sentMessageIds.add(messageData.id);
            
            // Enviar mensaje al servidor
            this.socket.send(JSON.stringify(messageData));
            
            // Mostrar mensaje localmente (con isOwn=true)
            this.displayMessage({...messageData, isOwn: true});
            this.messageInput.value = '';
        }
        
        // Enviar imagen
        if (this.pendingImage && this.isConnected) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // ID único
                username: this.username,
                content: this.pendingImage,
                timestamp: new Date().toISOString(),
                type: 'image'
            };
            
            console.log('📤 Enviando imagen:', messageData.id);
            
            // Registrar que enviamos esta imagen
            this.sentMessageIds.add(messageData.id);
            
            // Enviar imagen al servidor
            this.socket.send(JSON.stringify(messageData));
            
            // Mostrar imagen localmente (con isOwn=true)
            this.displayMessage({...messageData, isOwn: true});
            this.pendingImage = null;
            this.imageInput.value = '';
            this.sendButton.textContent = 'Enviar';
            this.sendButton.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        }
    }

    displayMessage(messageData) {
        console.log('👁️ Mostrando mensaje:', messageData);
        
        // Convertir timestamp a objeto Date si es string
        if (typeof messageData.timestamp === 'string') {
            messageData.timestamp = new Date(messageData.timestamp);
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.isOwn ? 'user' : 'other'}`;
        messageElement.dataset.messageId = messageData.id;
        
        const hours = messageData.timestamp.getHours().toString().padStart(2, '0');
        const minutes = messageData.timestamp.getMinutes().toString().padStart(2, '0');
        
        let contentHTML = '';
        if (messageData.type === 'image') {
            contentHTML = `<img src="${this.escapeHtml(messageData.content)}" alt="Imagen" class="message-image">`;
        } else {
            contentHTML = `<div class="message-content">${this.escapeHtml(messageData.content)}</div>`;
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${this.escapeHtml(messageData.username)}</span>
                <span class="timestamp">${hours}:${minutes}</span>
            </div>
            ${contentHTML}
            <div class="message-timer">Desaparece en 5s</div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        // Iniciar temporizador para eliminar el mensaje (5 segundos después de recibirlo)
        this.startMessageTimer(messageElement, messageData);
    }

    startMessageTimer(messageElement, messageData) {
        let timeLeft = 5;
        
        const interval = setInterval(() => {
            timeLeft--;
            
            // Actualizar contador visual
            const timerElement = messageElement.querySelector('.message-timer');
            if (timerElement) {
                timerElement.textContent = `Desaparece en ${timeLeft}s`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                messageElement.classList.add('fade-out');
                
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                    }
                }, 500);
            }
        }, 1000);
        
        // Guardar referencia al intervalo
        this.messageTimers.set(messageElement, interval);
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.innerHTML = `<span class="circle-icon"></span> Conectado como: ${this.username}`;
            this.connectionStatus.className = 'connection-status status-connected';
        } else {
            this.connectionStatus.innerHTML = `<span class="spinner"></span> Desconectado - Intentando reconectar...`;
            this.connectionStatus.className = 'connection-status status-disconnected';
        }
    }

    enableInputs() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.imageInput.disabled = false;
    }

    disableInputs() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.imageInput.disabled = true;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
