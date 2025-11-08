from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import re
import os

app = FastAPI()

# Configure allowed origins via environment variable for production safety.
# Set ALLOWED_ORIGINS to a comma-separated list (e.g. http://localhost:3000,https://yourdomain.com)
raw_origins = os.getenv("ALLOWED_ORIGINS")
# Control whether to allow credentials (cookies/authorization). Default: True for local dev.
allow_credentials_env = os.getenv("ALLOW_CREDENTIALS")
allow_credentials = True if (allow_credentials_env is None or allow_credentials_env.lower() != 'false') else False

if raw_origins:
    # Support a single '*' to allow all origins for quick testing. Note: when using '*',
    # credentials must be disabled per CORS rules, so we force allow_credentials=False.
    if raw_origins.strip() == '*':
        allow_origins = ["*"]
        allow_credentials = False
    else:
        allow_origins = [o.strip() for o in raw_origins.split(',') if o.strip()]
else:
    # sensible default for local development
    allow_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_script(text):
    """
    Strict TXT parser expects lines in the exact format:
      CHARACTER: dialogue
    Where CHARACTER is the character name (preferably uppercase) followed by ':' then the dialogue.

    Multi-line dialogue is supported: lines that do not start with 'NAME:' are appended to the last dialogue.
    Returns a list of {character, dialogue} entries.
    """
    lines = text.split('\n')
    script = []
    current_character = None
    current_dialogue = []
    # Matches lines like: NAME: Dialogue text
    header_re = re.compile(r'^([A-Z0-9 \-]{1,50}):\s*(.*)$')
    for raw in lines:
        line = raw.rstrip()
        if not line:
            # preserve paragraph breaks as spaces in dialogue
            if current_dialogue:
                current_dialogue.append('')
            continue
        m = header_re.match(line)
        if m:
            # flush previous
            if current_character and current_dialogue:
                script.append({'character': current_character, 'dialogue': ' '.join([p for p in current_dialogue if p != ''])})
            current_character = m.group(1).strip()
            first = m.group(2).strip()
            current_dialogue = [first] if first else []
        else:
            # continuation of previous dialogue
            if current_character is None:
                # line before any character header — ignore or treat as stage direction
                continue
            current_dialogue.append(line.strip())
    if current_character and current_dialogue:
        script.append({'character': current_character, 'dialogue': ' '.join([p for p in current_dialogue if p != ''])})
    return script

def get_characters(script):
    return list(set(item['character'] for item in script))


@app.get('/healthz')
def healthz():
    """Simple healthcheck for Render and load balancers."""
    return {"status": "ok"}

@app.post("/upload-script")
async def upload_script(file: UploadFile = File(...)):
    """
    Accept strictly formatted .txt files. The txt must follow the exact format:
      CHARACTER: dialogue
    One entry per line; multi-line dialogue allowed by continuing lines that do not start with 'NAME:'.
    """
    filename = file.filename or ''
    if not filename.lower().endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are accepted. Please convert your script to the required .txt format.")
    raw = await file.read()
    try:
        text = raw.decode('utf-8')
    except Exception:
        # fallback to latin-1 to avoid decode errors for some files
        try:
            text = raw.decode('latin-1')
        except Exception:
            raise HTTPException(status_code=400, detail="Could not decode uploaded file. Ensure it is UTF-8 encoded .txt")

    script = parse_script(text)
    characters = get_characters(script)
    return {"script": script, "characters": characters, "raw_text_preview": text[:2000]}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)