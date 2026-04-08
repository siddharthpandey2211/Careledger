"""
OCR Initialization Module
Manages PaddleOCR singleton with status tracking
"""
import json
import sys
from paddleocr import PaddleOCR

class OCRManager:
    """Manages OCR initialization and status"""
    _instance = None
    _ocr = None
    _status = "not_initialized"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OCRManager, cls).__new__(cls)
        return cls._instance
    
    @classmethod
    def get_status(cls):
        """Get current OCR status"""
        return cls._status
    
    @classmethod
    def is_initialized(cls):
        """Check if OCR is already initialized"""
        return cls._ocr is not None
    
    @classmethod
    def initialize(cls):
        """Initialize OCR (creates only once)"""
        if cls._ocr is not None:
            cls._status = "initialized"
            return {
                "status": "already_initialized",
                "message": "OCR already initialized",
                "initialized": True
            }
        
        try:
            cls._status = "initializing"
            print("[OCR_INIT] Starting PaddleOCR initialization...", file=sys.stderr)
            
            cls._ocr = PaddleOCR(
                text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="PP-OCRv5_mobile_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
            
            cls._status = "initialized"
            print("[OCR_INIT] PaddleOCR initialized successfully", file=sys.stderr)
            
            return {
                "status": "initialized",
                "message": "OCR initialized successfully",
                "initialized": True
            }
        except Exception as e:
            cls._status = "failed"
            print(f"[OCR_INIT] Initialization failed: {e}", file=sys.stderr)
            return {
                "status": "failed",
                "message": f"OCR initialization failed: {str(e)}",
                "initialized": False,
                "error": str(e)
            }
    
    @classmethod
    def get_ocr(cls):
        """Get OCR instance (must be initialized first)"""
        if cls._ocr is None:
            raise RuntimeError("OCR not initialized. Call initialize() first.")
        return cls._ocr


def main():
    """Check OCR initialization status"""
    manager = OCRManager()
    
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        # Just check status
        status_data = {
            "initialized": manager.is_initialized(),
            "status": manager.get_status()
        }
        print(json.dumps(status_data))
    else:
        # Initialize OCR
        result = manager.initialize()
        print(json.dumps(result))


if __name__ == "__main__":
    main()
