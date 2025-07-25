class ChatClient {
    constructor() {
        this.userId = this.getUserId();
        this.username = this.generateUsername();
        this.socket = null;
        this.isConnected = false;
        this.messageTimers = new Map();
        this.sentMessageIds = new Set();
        this.pendingImage = null;
        this.typingTimeout = null;
        this.isTyping = false;
        this.typingIndicators = new Map();
        this.pendingMessages = new Map(); // Solo para mensajes que enviamos
        this.displayedMessages = new Set(); // Mensajes ya mostrados
        this.readMessages = new Set(); // Mensajes que hemos leído
        
        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
        this.setupScrollListener();
    }

    getUserId() {
        // Generar ID consistente basado en características del navegador
        const navigatorInfo = navigator.userAgent + navigator.language + screen.width + screen.height;
        const idHash = btoa(navigatorInfo).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
        return 'user-' + idHash;
    }

    generateUsername() {
        // Intentar obtener username guardado
        const savedUsername = localStorage.getItem('chat-username-' + this.getUserId());
        if (savedUsername) {
            return savedUsername;
        }
        
        const adjectives = ['Rápido', 'Feliz', 'Listo', 'Genial', 'Único', 'Activo', 'Creativo', 'Dinámico'];
        const nouns = ['Usuario', 'Chat', 'Mensaje', 'Red', 'Local', 'Grupo', 'Equipo', 'Comunidad'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        const username = `${adj}${noun}${num}`;
        
        localStorage.setItem('chat-username-' + this.getUserId(), username);
        return username;
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.sendButton = document.getElementById('sendButton');
        this.imageInput = document.getElementById('imageInput');
    }

    initializeSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        try {
            this.socket = new WebSocket(`${protocol}//${host}`);
            this.setupWebSocketEvents();
        } catch (error) {
            console.error('Error al conectar al WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    setupScrollListener() {
        // Verificar mensajes visibles cuando se hace scroll
        this.messagesContainer.addEventListener('scroll', () => {
            this.checkVisibleMessages();
        });
        
        // También verificar periódicamente
        setInterval(() => {
            this.checkVisibleMessages();
        }, 1000);
    }

    setupWebSocketEvents() {
        this.socket.onopen = () => {
            console.log('✅ Conectado al servidor WebSocket');
            this.isConnected = true;
            
            // Solicitar mensajes históricos y enviar info de usuario
            this.requestHistoricalMessages();
            this.sendUserInfo();
            
            this.updateConnectionStatus(true);
            this.enableInputs();
            
            // Verificar mensajes visibles después de conectar
            setTimeout(() => {
                this.checkVisibleMessages();
            }, 1000);
        };

        this.socket.onmessage = (event) => {
            try {
                console.log('📥 Mensaje recibido del servidor:', event.data);
                const messageData = JSON.parse(event.data);
                
                switch (messageData.type) {
                    case 'user-info-ack':
                        break;
                    case 'typing':
                        this.handleTypingMessage(messageData);
                        break;
                    case 'stop-typing':
                        this.handleStopTypingMessage(messageData);
                        break;
                    case 'read-receipt':
                        this.handleReadReceipt(messageData);
                        break;
                    case 'historical-messages':
                        this.handleHistoricalMessages(messageData);
                        break;
                    case 'text':
                    case 'image':
                        this.handleNewMessage(messageData);
                        break;
                    default:
                        this.handleNewMessage(messageData);
                }
            } catch (error) {
                console.error('❌ Error al procesar mensaje:', error);
            }
        };

        this.socket.onclose = () => {
            console.log('🔌 Desconectado del servidor WebSocket');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.disableInputs();
            this.clearAllTypingIndicators();
            
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

    sendUserInfo() {
        const userInfo = {
            type: 'user-info',
            userId: this.userId,
            username: this.username,
            timestamp: new Date().toISOString()
        };
        this.socket.send(JSON.stringify(userInfo));
    }

    requestHistoricalMessages() {
        const request = {
            type: 'request-historical',
            userId: this.userId,
            timestamp: new Date().toISOString()
        };
        this.socket.send(JSON.stringify(request));
    }

    handleHistoricalMessages(messageData) {
        if (messageData.messages && Array.isArray(messageData.messages)) {
            messageData.messages.forEach(msg => {
                if (!this.displayedMessages.has(msg.id)) {
                    this.displayedMessages.add(msg.id);
                    const isOwnMessage = msg.userId === this.userId;
                    this.displayMessage({...msg, isOwn: isOwnMessage});
                }
            });
            
            // Verificar mensajes visibles después de cargar históricos
            setTimeout(() => {
                this.checkVisibleMessages();
            }, 500);
        }
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        this.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageSelection(file);
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.handleTyping();
        });
        
        this.messageInput.addEventListener('blur', () => {
            this.stopTyping();
        });
    }

    checkVisibleMessages() {
        if (!this.isConnected) return;
        
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(messageElement => {
            const messageId = messageElement.dataset.messageId;
            const messageUserId = messageElement.dataset.userId;
            
            // Verificar si el mensaje está visible en el viewport
            const rect = messageElement.getBoundingClientRect();
            const containerRect = this.messagesContainer.getBoundingClientRect();
            
            const isVisible = (
                rect.top >= containerRect.top &&
                rect.bottom <= containerRect.bottom &&
                rect.width > 0 &&
                rect.height > 0
            );
            
            // Solo enviar acuse de lectura para mensajes de otros usuarios
            // que no hemos leído antes
            if (isVisible && 
                messageId && 
                messageUserId !== this.userId && 
                !this.readMessages.has(messageId)) {
                
                this.readMessages.add(messageId);
                this.sendReadReceipt(messageId);
                messageElement.classList.add('read');
                console.log('✅ Mensaje leído y marcado:', messageId);
            }
        });
    }

    handleTyping() {
        if (!this.isConnected) return;
        
        if (!this.isTyping) {
            this.isTyping = true;
            const typingMessage = {
                type: 'typing',
                userId: this.userId,
                username: this.username,
                timestamp: new Date().toISOString()
            };
            this.socket.send(JSON.stringify(typingMessage));
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    }

    stopTyping() {
        if (this.isTyping && this.isConnected) {
            this.isTyping = false;
            clearTimeout(this.typingTimeout);
            
            const stopTypingMessage = {
                type: 'stop-typing',
                userId: this.userId,
                username: this.username,
                timestamp: new Date().toISOString()
            };
            this.socket.send(JSON.stringify(stopTypingMessage));
        }
    }

    handleTypingMessage(messageData) {
        if (messageData.userId === this.userId) return;
        this.showTypingIndicator(messageData.username);
    }

    handleStopTypingMessage(messageData) {
        if (messageData.userId === this.userId) return;
        this.hideTypingIndicator(messageData.username);
    }

    handleReadReceipt(receiptData) {
        // Solo procesar si el lector no es el mismo usuario
        if (receiptData.readerId === this.userId) return;
        
        console.log('📥 Recibido acuse de lectura para mensaje:', receiptData.messageId);
        
        if (this.pendingMessages.has(receiptData.messageId)) {
            const messageInfo = this.pendingMessages.get(receiptData.messageId);
            
            if (messageInfo.element) {
                messageInfo.element.classList.remove('pending-read');
                messageInfo.element.classList.add('read');
            }
            
            // Iniciar temporizador de eliminación para mensajes propios leídos
            this.startMessageDeletionTimer(messageInfo.element, receiptData.messageId);
        }
    }

    handleNewMessage(messageData) {
        if (this.displayedMessages.has(messageData.id)) {
            return;
        }
        
        this.displayedMessages.add(messageData.id);
        const isOwnMessage = messageData.userId === this.userId;
        messageData.isOwn = isOwnMessage;
        
        this.hideTypingIndicator(messageData.username);
        this.displayMessage(messageData);
        
        // Verificar si es visible inmediatamente
        setTimeout(() => {
            this.checkVisibleMessages();
        }, 100);
    }

    sendReadReceipt(messageId) {
        const receiptMessage = {
            type: 'read-receipt',
            messageId: messageId,
            readerId: this.userId,
            reader: this.username,
            timestamp: new Date().toISOString()
        };
        this.socket.send(JSON.stringify(receiptMessage));
        console.log('📤 Enviando acuse de lectura para mensaje:', messageId);
    }

    showTypingIndicator(username) {
        if (this.typingIndicators.has(username)) {
            clearTimeout(this.typingIndicators.get(username).timeout);
        } else {
            const indicatorElement = document.createElement('div');
            indicatorElement.className = 'typing-indicator';
            indicatorElement.id = `typing-${username}`;
            indicatorElement.innerHTML = `
                <span class="typing-indicator-text">${this.escapeHtml(username)} está escribiendo</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
            
            this.messagesContainer.appendChild(indicatorElement);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            
            const timeout = setTimeout(() => {
                this.hideTypingIndicator(username);
            }, 5000);
            
            this.typingIndicators.set(username, {
                element: indicatorElement,
                timeout: timeout
            });
        }
    }

    hideTypingIndicator(username) {
        if (this.typingIndicators.has(username)) {
            const indicator = this.typingIndicators.get(username);
            clearTimeout(indicator.timeout);
            if (indicator.element.parentNode) {
                indicator.element.parentNode.removeChild(indicator.element);
            }
            this.typingIndicators.delete(username);
        }
    }

    clearAllTypingIndicators() {
        this.typingIndicators.forEach((indicator, username) => {
            clearTimeout(indicator.timeout);
            if (indicator.element.parentNode) {
                indicator.element.parentNode.removeChild(indicator.element);
            }
        });
        this.typingIndicators.clear();
    }

    handleImageSelection(file) {
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona solo archivos de imagen');
            this.imageInput.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es muy grande. Máximo 5MB');
            this.imageInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingImage = e.target.result;
            this.sendButton.textContent = '📷 Enviar Imagen';
            this.sendButton.style.background = 'linear-gradient(135deg, #5e81ac, #81a1c1)';
        };
        reader.readAsDataURL(file);
    }

    sendMessage() {
        const textMessage = this.messageInput.value.trim();
        
        if (textMessage && this.isConnected) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                userId: this.userId,
                username: this.username,
                content: textMessage,
                timestamp: new Date().toISOString(),
                type: 'text'
            };
            
            console.log('📤 Enviando mensaje de texto:', messageData);
            
            this.sentMessageIds.add(messageData.id);
            this.socket.send(JSON.stringify(messageData));
            this.displayMessage({...messageData, isOwn: true});
            this.messageInput.value = '';
            this.stopTyping();
        }
        
        if (this.pendingImage && this.isConnected) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                userId: this.userId,
                username: this.username,
                content: this.pendingImage,
                timestamp: new Date().toISOString(),
                type: 'image'
            };
            
            console.log('📤 Enviando imagen:', messageData.id);
            
            this.sentMessageIds.add(messageData.id);
            this.socket.send(JSON.stringify(messageData));
            this.displayMessage({...messageData, isOwn: true});
            this.pendingImage = null;
            this.imageInput.value = '';
            this.sendButton.textContent = 'Enviar';
            this.sendButton.style.background = 'linear-gradient(135deg, #5e81ac, #81a1c1)';
            this.stopTyping();
        }
    }

    displayMessage(messageData) {
        console.log('👁️ Mostrando mensaje:', messageData);
        
        if (typeof messageData.timestamp === 'string') {
            messageData.timestamp = new Date(messageData.timestamp);
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.isOwn ? 'user' : 'other'}`;
        messageElement.dataset.messageId = messageData.id;
        messageElement.dataset.userId = messageData.userId;
        
        // Agregar estado de lectura para mensajes propios
        if (messageData.isOwn) {
            messageElement.classList.add('pending-read');
        }
        
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
        
        // Registrar mensaje pendiente si es nuestro
        if (messageData.isOwn) {
            this.pendingMessages.set(messageData.id, {
                element: messageElement,
                timestamp: Date.now()
            });
        } else {
            // Para mensajes de otros, iniciar temporizador inmediatamente
            this.startMessageTimer(messageElement, messageData);
        }
    }

    startMessageDeletionTimer(messageElement, messageId) {
        console.log('⏱️ Iniciando temporizador de eliminación para mensaje:', messageId);
        let timeLeft = 5;
        
        const interval = setInterval(() => {
            timeLeft--;
            
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
                        this.pendingMessages.delete(messageId);
                    }
                }, 500);
            }
        }, 1000);
        
        this.messageTimers.set(messageId, interval);
    }

    startMessageTimer(messageElement, messageData) {
        let timeLeft = 5;
        
        const interval = setInterval(() => {
            timeLeft--;
            
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
        this.stopTyping();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
