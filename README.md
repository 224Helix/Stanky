# Stanky

This is a fun little web application intended to help actors for screen and stage memorize their lines.

It works by taking in a script, identifying the characters within the script, then selecting which character you want to learn.

It then generates voice-overs for all other characters, or allows you to record your own.

All voices are generated using the browser's Web Speech API.

## Setup

1. Install Python dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

2. Run the backend:
   ```
   cd backend
   python app.py
   ```

3. Serve the frontend:
   ```
   cd frontend
   python -m http.server 3000
   ```

4. Open http://localhost:3000 in your browser.

## Features

- Upload PDF script
- Automatic character detection
- Select your character
- Generate TTS voices for other characters using Web Speech API
- Record your own voices for characters
- Sequential playback with pauses for your lines
- Responsive design for different screen sizes