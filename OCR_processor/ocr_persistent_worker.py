import os
import json
import sys
from dotenv import load_dotenv

load_dotenv()
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_call_stack_level'] = '2'

from ocr_init import OCRManager

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

from ollama import Client

# ── API SELECTION ──────────────────────────────────────────────────────────────
USE_GEMINI = False
USE_OLLAMA = True

# ── Initialize Clients ─────────────────────────────────────────────────────────
if USE_GEMINI:
    if genai is None:
        raise RuntimeError("Gemini client dependencies are unavailable")
    gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

if not USE_GEMINI:
    ollama_key = os.environ.get('OLLAMA_API_KEY') or 'dummy'
    ollama_client = Client(
        host="http://localhost:11434",
        headers={'Authorization': f'Bearer {ollama_key}'}
    )

# ── Global OCR Manager (Persistent) ────────────────────────────────────────────
ocr_manager = None

PLACEHOLDER_DRUG = {
    "drug_name": "UNKNOWN",
    "dosage": "UNKNOWN",
    "frequency": "UNKNOWN",
    "duration_days": -1,
}

SYSTEM_PROMPT = """You are a strict medical prescription parser. Your ONLY job is to extract medication information from OCR text and return valid JSON.

RULES — read carefully:
1. Extract ONLY: drug_name, dosage, frequency, duration_days.
2. Ignore everything else — doctor names, patient info, clinic addresses, dates, diagnoses, stamps, etc.
3. If the OCR text contains NO recognizable drug/medication information, return:
   {"error": "NO_PRESCRIPTION_DATA", "drugs": []}
4. If a specific field cannot be determined for a drug, use "UNKNOWN" for strings and -1 for duration_days.
5. NEVER invent or hallucinate drug names, dosages, or frequencies not present in the text.
6. duration_days must be an integer (e.g. 7, 14, 30) or -1 if not found.
7. frequency must be a human-readable string: e.g. "Once daily", "Twice daily", "Every 8 hours", "As needed".
8. Return ONLY raw JSON — no markdown, no explanation, no preamble.
9. The Drug Name Usually ends with Tablet or Syrup
OUTPUT FORMAT (strictly follow this):
{ "date" :"DD/MM/YYYY",
  "drugs": [
    {
      "drug_name": "string",
      "dosage": "string",
      "frequency": "string",
      "duration_days": integer
    }
  ]
}
"""


def emit_message(msg_type: str, data: dict):
    """Emit a message to Node.js (JSON line)"""
    message = {"type": msg_type}
    message.update(data)
    print(json.dumps(message))
    sys.stdout.flush()


def emit_checkpoint(step: str, status: str, message: str = "", data: dict = None):
    """Emit a checkpoint for progress tracking"""
    emit_message("checkpoint", {
        "checkpoint": step,
        "status": status,
        "message": message,
        "data": data or {}
    })


def parse_prescription(ocr_text: str) -> dict:
    """Parse OCR text using LLM (Gemini or Ollama)"""
    if not ocr_text.strip():
        return {"error": "EMPTY_OCR_TEXT", "drugs": []}

    try:
        # ── Using Gemini API ───────────────────────────────────────────────────
        if USE_GEMINI:
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=1024,
                    temperature=0,
                ),
                contents=f"Parse this prescription OCR text:\n\n{ocr_text}",
            )
            raw = response.text.strip()

        # ── Using Ollama API ───────────────────────────────────────────────────
        else:
            messages = [
                {
                    'role': 'system',
                    'content': SYSTEM_PROMPT,
                },
                {
                    'role': 'user',
                    'content': f"Parse this prescription OCR text:\n\n{ocr_text}",
                },
            ]
            response_text = ""
            for part in ollama_client.chat('deepseek-v3.2:cloud', messages=messages, stream=True, think=False):
                response_text += part['message']['content']
            raw = response_text.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)

        if "drugs" not in parsed:
            raise ValueError("Missing 'drugs' key in response")

        validated_drugs = []
        for drug in parsed["drugs"]:
            validated_drugs.append(
                {
                    "drug_name": str(drug.get("drug_name", "UNKNOWN")),
                    "dosage": str(drug.get("dosage", "UNKNOWN")),
                    "frequency": str(drug.get("frequency", "UNKNOWN")),
                    "duration_days": int(drug.get("duration_days", -1)),
                }
            )

        return {"drugs": validated_drugs}

    except json.JSONDecodeError as e:
        emit_checkpoint("PARSING", "warning", f"JSON decode failed: {str(e)}")
        return {"error": "PARSE_FAILED", "drugs": [PLACEHOLDER_DRUG]}

    except Exception as e:
        emit_checkpoint("PARSING", "warning", f"LLM parsing error: {str(e)}")
        return {"error": "LLM_ERROR", "drugs": [PLACEHOLDER_DRUG]}


def process_request(image_path: str, request_id: str):
    """Process a single OCR request"""
    try:
        # ── Checkpoint 1: File Validation ──────────────────────────────────
        emit_checkpoint("FILE_CHECK", "in_progress", f"Checking if file exists: {image_path}")

        if not os.path.exists(image_path):
            emit_checkpoint("FILE_CHECK", "failed", f"File not found: {image_path}")
            emit_message("done", {"request_id": request_id, "success": False})
            return

        emit_checkpoint("FILE_CHECK", "completed", "File verified")

        # ── Checkpoint 2: Ensure OCR is initialized ────────────────────────
        emit_checkpoint("OCR_CHECK", "in_progress", "Checking OCR initialization status")

        if ocr_manager.is_initialized():
            emit_checkpoint("OCR_CHECK", "completed", "OCR already initialized")
        else:
            emit_checkpoint("OCR_INIT", "failed", "OCR manager not initialized")
            emit_message("done", {"request_id": request_id, "success": False})
            return

        # ── Checkpoint 3: Run OCR Prediction ───────────────────────────────
        emit_checkpoint("OCR_PREDICTION", "in_progress", "Running OCR prediction on image")

        try:
            ocr = ocr_manager.get_ocr()
            result = ocr.predict(image_path)

            ocr_text = ""
            for res in result:
                ocr_text += "\n".join(res["rec_texts"]) + "\n"

            emit_checkpoint("OCR_PREDICTION", "completed", "OCR prediction completed", {
                "text_length": len(ocr_text),
                "lines_detected": len(ocr_text.strip().split("\n"))
            })

        except Exception as e:
            emit_checkpoint("OCR_PREDICTION", "failed", f"OCR prediction failed: {str(e)}")
            emit_message("done", {"request_id": request_id, "success": False})
            return

        # ── Checkpoint 4: Parse Prescription ───────────────────────────────
        emit_checkpoint("PARSING", "in_progress", "Parsing prescription data with LLM")

        prescription = parse_prescription(ocr_text.strip())

        if prescription.get("error"):
            emit_checkpoint("PARSING", "warning", f"Parsing completed with warning: {prescription.get('error')}")
        else:
            emit_checkpoint("PARSING", "completed", f"Parsed {len(prescription.get('drugs', []))} drugs")

        # ── Checkpoint 5: Complete ────────────────────────────────────────
        emit_checkpoint("COMPLETE", "success", "Prescription processing completed", prescription)

        # ── Signal completion ──────────────────────────────────────────────
        emit_message("done", {
            "request_id": request_id,
            "success": True,
            "prescription": prescription
        })

    except Exception as e:
        emit_checkpoint("COMPLETE", "failed", f"Unexpected error: {str(e)}")
        emit_message("done", {"request_id": request_id, "success": False, "error": str(e)})


def initialize_ocr():
    """Initialize OCR manager (runs once at startup)"""
    global ocr_manager
    
    emit_message("status", {
        "message": "Initializing OCR manager",
        "status": "initializing"
    })
    
    ocr_manager = OCRManager()
    result = ocr_manager.initialize()
    
    if result.get("initialized"):
        emit_message("status", {
            "message": "OCR manager initialized successfully",
            "status": "ready",
            "initialized": True
        })
        return True
    else:
        emit_message("status", {
            "message": f"OCR initialization failed: {result.get('error')}",
            "status": "failed",
            "initialized": False
        })
        return False


def main():
    """Main worker loop"""
    print("[WORKER] OCR Persistent Worker Starting...", file=sys.stderr)
    
    # Initialize OCR on startup
    if not initialize_ocr():
        print("[WORKER] Failed to initialize OCR. Exiting.", file=sys.stderr)
        sys.exit(1)
    
    print("[WORKER] Ready to receive requests", file=sys.stderr)
    
    # Listen for requests from Node.js on stdin
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                request = json.loads(line)
                image_path = request.get("image_path")
                request_id = request.get("request_id", "unknown")
                
                if not image_path:
                    emit_message("error", {
                        "request_id": request_id,
                        "message": "Missing image_path in request"
                    })
                    continue
                
                print(f"[WORKER] Processing request {request_id}: {image_path}", file=sys.stderr)
                process_request(image_path, request_id)
                
            except json.JSONDecodeError as e:
                print(f"[WORKER] Invalid JSON received: {e}", file=sys.stderr)
                continue
            except Exception as e:
                print(f"[WORKER] Error processing request: {e}", file=sys.stderr)
                continue
                
    except KeyboardInterrupt:
        print("[WORKER] Shutting down gracefully...", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"[WORKER] Fatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
