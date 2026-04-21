# Image Integration Testing Playbook

## Rules for Test Agent
- Always use base64-encoded images (JPEG/PNG/WEBP only).
- Do not use SVG/BMP/HEIC or other formats.
- Do not upload blank / solid-color / uniform images. Every image must have real objects/edges/textures.
- If image format after transformation differs from original, re-detect MIME.
- If GIF/APNG/WEBP animation, extract first frame only.
- Resize oversized images before upload.

## Two-Wheeler CRM Document OCR
- Endpoint: POST /api/documents/{document_id}/ocr
- Auth: Bearer token
- Sales executive can trigger OCR for own leads; admin for branch; super_admin all.
- Expected JSON from Gemini (via emergentintegrations LlmChat, gemini-2.5-flash):
  { "document_number", "name", "address", "chassis_number", "engine_number",
    "vehicle_model", "variant", "confidence_score" }
- Test with a real sample Aadhaar/PAN/Sale Challan image (base64 JPEG/PNG).
- If confidence_score < 0.6, document.needs_manual_verification = true.
