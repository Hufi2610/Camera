// Barcode Scanner Application
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
        
        this.initEventListeners();
    }

    initEventListeners() {
        this.scanButton.addEventListener('click', () => this.startScanning());
        this.closeButton.addEventListener('click', () => this.stopScanning());
        this.clearButton.addEventListener('click', () => this.clearInput());
        this.copyButton.addEventListener('click', () => this.copyToClipboard());
        
        // Update button states based on input
        this.barcodeInput.addEventListener('input', () => this.updateButtonStates());
    }

    async startScanning() {
        try {
            this.showStatus('Khởi động camera...', 'info');
            this.scanButton.disabled = true;
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Rear camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            // Set video source
            this.cameraFeed.srcObject = this.stream;
            
            // Show camera container
            this.cameraContainer.classList.remove('hidden');
            this.isScanning = true;
            document.body.classList.add('camera-active');
            
            this.showStatus('Camera sẵn sàng - Hướng vào mã vạch', 'info');
            
            // Start barcode detection
            this.detectBarcode();
            
        } catch (error) {
            this.handleError(error);
            this.scanButton.disabled = false;
        }
    }

    stopScanning() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.cameraFeed.srcObject = null;
        this.cameraContainer.classList.add('hidden');
        this.isScanning = false;
        document.body.classList.remove('camera-active');
        this.scanButton.disabled = false;
        this.showStatus('', '');
    }

    async detectBarcode() {
        if (!this.isScanning) return;

        try {
            const ctx = this.canvas.getContext('2d');
            
            // Set canvas size to match video
            this.canvas.width = this.cameraFeed.videoWidth;
            this.canvas.height = this.cameraFeed.videoHeight;

            if (this.canvas.width === 0 || this.canvas.height === 0) {
                // Video not ready yet, retry
                requestAnimationFrame(() => this.detectBarcode());
                return;
            }

            // Draw video frame to canvas
            ctx.drawImage(this.cameraFeed, 0, 0, this.canvas.width, this.canvas.height);

            // Get image data
            const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

            // Use Quagga for barcode detection
            this.detectWithQuagga(imageData);

        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue scanning
        if (this.isScanning) {
            requestAnimationFrame(() => this.detectBarcode());
        }
    }

    detectWithQuagga(imageData) {
        try {
            // Use Quagga2 for detection
            Quagga.decodeSingle({
                src: this.canvas.toDataURL('image/png'),
                numOfWorkers: 0,
                inputStream: {
                    type: 'ImageStream',
                    constraints: {
                        width: { min: 640 },
                        height: { min: 480 }
                    }
                },
                decoder: {
                    readers: [
                        'code_128_reader',
                        'ean_reader',
                        'ean_8_reader',
                        'code_39_reader',
                        'code_39_vin_reader',
                        'codabar_reader',
                        'upc_reader',
                        'upc_e_reader',
                        'i2of5_reader',
                        'upca_reader',
                        'code_93_reader'
                    ]
                }
            }, (result) => {
                if (result && result.codeResult && result.codeResult.code) {
                    this.onBarcodeDetected(result.codeResult.code);
                }
            });
        } catch (error) {
            console.error('Quagga error:', error);
            // Fallback to jsQR for QR codes
            this.detectQRCode();
        }
    }

    detectQRCode() {
        // Simple QR code detection using jsQR approach (if available)
        // This is a fallback if Quagga fails
        try {
            const canvas = this.canvas;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Try to detect using image processing
            // For now, we rely on Quagga
        } catch (error) {
            console.error('QR detection error:', error);
        }
    }

    onBarcodeDetected(code) {
        // Prevent duplicate detections
        if (this.barcodeInput.value === code) {
            return;
        }

        this.barcodeInput.value = code;
        this.showStatus(`✓ Đã quét: ${code}`, 'success');
        
        // Optional: Play success sound
        this.playSuccessSound();
        
        // Stop scanning after successful detection
        setTimeout(() => {
            this.stopScanning();
        }, 500);
    }

    playSuccessSound() {
        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
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
            await navigator.clipboard.writeText(text);
            this.showStatus('Đã sao chép vào clipboard!', 'success');
            
            // Reset message after 2 seconds
            setTimeout(() => {
                this.showStatus('', '');
            }, 2000);
        } catch (error) {
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showStatus('Đã sao chép vào clipboard!', 'success');
                
                setTimeout(() => {
                    this.showStatus('', '');
                }, 2000);
            } catch (e) {
                this.showStatus('Sao chép thất bại', 'error');
            }
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
            errorMessage = 'Vui lòng cấp quyền truy cập camera';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'Không tìm thấy camera';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera đang được sử dụng';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Camera không khả dụng vì lý do bảo mật';
        }
        
        this.showStatus(errorMessage, 'error');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BarcodeScanner();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.scanner && window.scanner.isScanning) {
        window.scanner.stopScanning();
    }
});
