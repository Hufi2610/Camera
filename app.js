// Barcode & QR Code Scanner using ZXing
class BarcodeScanner {
    constructor() {
        this.barcodeInput = document.getElementById('barcodeInput');
        this.scanButton = document.getElementById('scanButton');
        this.closeButton = document.getElementById('closeButton');
        this.clearButton = document.getElementById('clearButton');
        this.copyButton = document.getElementById('copyButton');
        this.cameraContainer = document.getElementById('cameraContainer');
        this.cameraFeed = document.getElementById('cameraFeed');
        this.canvas = document.getElementById('canvas');
        this.statusMessage = document.getElementById('status');
        
        this.isScanning = false;
        this.stream = null;
        this.codeReader = null;
        this.detectionFrameCount = 0;
        this.detectedCodes = new Set();
        
        this.initEventListeners();
        this.initZXing();
    }

    initZXing() {
        try {
            const { BrowserMultiFormatReader } = ZXing;
            this.codeReader = new BrowserMultiFormatReader();
        } catch (error) {
            console.error('Failed to initialize ZXing:', error);
        }
    }

    initEventListeners() {
        this.scanButton.addEventListener('click', () => this.startScanning());
        this.closeButton.addEventListener('click', () => this.stopScanning());
        this.clearButton.addEventListener('click', () => this.clearInput());
        this.copyButton.addEventListener('click', () => this.copyToClipboard());
        
        this.barcodeInput.addEventListener('input', () => this.updateButtonStates());
    }

    async startScanning() {
        try {
            this.showStatus('Khởi động camera...', 'info');
            this.scanButton.disabled = true;
            this.detectedCodes.clear();
            this.detectionFrameCount = 0;
            
            // Request camera with appropriate constraints
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    // Add focus and zoom settings for better detection
                    focusMode: ['continuous', 'auto'],
                    torch: false
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cameraFeed.srcObject = this.stream;
            
            // Show camera container
            this.cameraContainer.classList.remove('hidden');
            this.isScanning = true;
            document.body.classList.add('camera-active');
            
            // Wait for video to load before starting detection
            this.cameraFeed.onloadedmetadata = () => {
                this.showStatus('📷 Camera sẵn sàng - Hướng vào mã vạch hoặc QR', 'info');
                this.detectBarcode();
            };
            
        } catch (error) {
            this.handleError(error);
            this.scanButton.disabled = false;
        }
    }

    stopScanning() {
        this.isScanning = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.cameraFeed.srcObject = null;
        this.cameraContainer.classList.add('hidden');
        document.body.classList.remove('camera-active');
        this.scanButton.disabled = false;
        this.showStatus('', '');
    }

    async detectBarcode() {
        if (!this.isScanning) return;

        try {
            // Process every 2nd frame to improve performance
            this.detectionFrameCount++;
            if (this.detectionFrameCount % 2 === 0) {
                const ctx = this.canvas.getContext('2d');
                const width = this.cameraFeed.videoWidth;
                const height = this.cameraFeed.videoHeight;

                if (width && height) {
                    this.canvas.width = width;
                    this.canvas.height = height;
                    
                    // Draw video frame to canvas
                    ctx.drawImage(this.cameraFeed, 0, 0, width, height);
                    
                    // Try detection
                    await this.decodeFromCanvas();
                }
            }
        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue scanning
        if (this.isScanning) {
            requestAnimationFrame(() => this.detectBarcode());
        }
    }

    async decodeFromCanvas() {
        try {
            const ctx = this.canvas.getContext('2d');
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Try jsQR first (for QR codes - very reliable)
            const imageData = ctx.getImageData(0, 0, width, height);
            const qrResult = jsQR(imageData.data, width, height, {
                inversionAttempts: 'dontInvert'
            });
            
            if (qrResult && qrResult.data) {
                this.onBarcodeDetected(qrResult.data);
                return;
            }
            
            // If jsQR didn't find anything, try ZXing (for barcodes)
            try {
                const image = new Image();
                image.src = this.canvas.toDataURL('image/png');
                
                // Use timeout to prevent hanging
                const decodePromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Decode timeout')), 500);
                    
                    this.codeReader.decodeFromImage(image)
                        .then(result => {
                            clearTimeout(timeout);
                            resolve(result);
                        })
                        .catch(error => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                });
                
                const barcodeResult = await decodePromise;
                if (barcodeResult && barcodeResult.text) {
                    this.onBarcodeDetected(barcodeResult.text);
                }
            } catch (error) {
                // ZXing failed - continue scanning
                console.debug('Barcode detection attempt failed - continuing scan');
            }
        } catch (error) {
            console.error('Canvas decode error:', error);
        }
    }

    onBarcodeDetected(code) {
        // Prevent duplicate detections in rapid succession
        if (this.detectedCodes.has(code)) {
            return;
        }

        this.detectedCodes.add(code);
        this.barcodeInput.value = code;
        this.showStatus(`✓ Đã quét: ${code}`, 'success');
        
        // Play success sound
        this.playSuccessSound();
        
        // Stop scanning after successful detection
        setTimeout(() => {
            this.stopScanning();
        }, 800);
    }

    playSuccessSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioContext.currentTime;
            
            // First beep
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.connect(gain1);
            gain1.connect(audioContext.destination);
            osc1.frequency.value = 900;
            gain1.gain.setValueAtTime(0.2, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc1.start(now);
            osc1.stop(now + 0.15);
            
            // Second beep (higher pitch)
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.value = 1200;
            gain2.gain.setValueAtTime(0.2, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.3);
        } catch (error) {
            console.error('Audio error:', error);
        }
    }

    clearInput() {
        this.barcodeInput.value = '';
        this.showStatus('', '');
        this.updateButtonStates();
    }

    async copyToClipboard() {
        const text = this.barcodeInput.value;
        if (!text) {
            this.showStatus('Không có gì để sao chép', 'error');
            return;
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            
            this.showStatus('✓ Đã sao chép!', 'success');
            setTimeout(() => {
                this.showStatus('', '');
            }, 1500);
        } catch (error) {
            console.error('Copy error:', error);
            this.showStatus('Sao chép thất bại', 'error');
        }
    }

    updateButtonStates() {
        const hasValue = this.barcodeInput.value.trim() !== '';
        this.clearButton.disabled = !hasValue;
        this.copyButton.disabled = !hasValue;
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
    }

    handleError(error) {
        console.error('Camera error:', error);
        
        let errorMessage = 'Lỗi không xác định';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDenied') {
            errorMessage = '❌ Vui lòng cấp quyền truy cập camera';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = '❌ Không tìm thấy camera';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = '❌ Camera đang được sử dụng';
        } else if (error.name === 'SecurityError') {
            errorMessage = '❌ Camera không khả dụng vì lý do bảo mật';
        }
        
        this.showStatus(errorMessage, 'error');
    }
}

// Initialize when DOM is ready
let scannerInstance;
document.addEventListener('DOMContentLoaded', () => {
    scannerInstance = new BarcodeScanner();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stopScanning();
    }
});
