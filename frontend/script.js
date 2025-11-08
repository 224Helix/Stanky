let script = [];
let characters = [];
let userCharacter = '';
let voices = {}; // character -> {type: 'generated' or 'recorded', audio: blob or url}
let currentIndex = 0;
let mediaRecorder;
let recordedChunks = [];

document.getElementById('upload-btn').addEventListener('click', uploadScript);
document.getElementById('select-character-btn').addEventListener('click', selectCharacter);
document.getElementById('start-memorization-btn').addEventListener('click', startMemorization);
document.getElementById('play-btn').addEventListener('click', playScript);
document.getElementById('pause-btn').addEventListener('click', pauseScript);
document.getElementById('next-btn').addEventListener('click', nextLine);
document.getElementById('submit-line-btn').addEventListener('click', submitLine);
document.getElementById('start-record-btn').addEventListener('click', startRecording);
document.getElementById('stop-record-btn').addEventListener('click', stopRecording);
document.getElementById('save-voice-btn').addEventListener('click', saveVoice);

async function uploadScript() {
    const fileInput = document.getElementById('script-file');
    const file = fileInput.files[0];
    if (!file) return alert('Select a file');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('https://stanky-backend.onrender.com/upload-script', {
            method: 'POST',
            body: formData
        });

        // Read text first so we can surface non-JSON error responses.
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('Upload: server returned non-JSON response:', text);
            alert('Server returned an unexpected response. See console for details.');
            return;
        }

        if (!response.ok) {
            console.error('Upload failed', response.status, data);
            const errMsg = data.detail || data.error || ('HTTP ' + response.status);
            alert('Upload failed: ' + errMsg);
            return;
        }

        script = data.script || [];
        characters = data.characters || [];

        if (!characters || characters.length === 0) {
            console.warn('No characters returned from backend for uploaded script.');
            alert('No characters found in the uploaded script. The parser may be too strict or the PDF text could not be extracted.');
            return;
        }

        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('character-selection').style.display = 'block';
        const select = document.getElementById('character-select');
        select.innerHTML = '';
        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char;
            option.textContent = char;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Upload request failed', err);
        alert('Upload request failed. Check the network tab and ensure the backend is running and CORS allows this origin.');
    }
}

function selectCharacter() {
    userCharacter = document.getElementById('character-select').value;
    document.getElementById('character-selection').style.display = 'none';
    document.getElementById('voice-setup').style.display = 'block';
    const voicesList = document.getElementById('voices-list');
    voicesList.innerHTML = '';
    characters.filter(c => c !== userCharacter).forEach(char => {
        const div = document.createElement('div');
        div.className = 'voice-item';
        div.innerHTML = `
            <strong>${char}</strong>
            <button onclick="generateVoice('${char}')">Generate TTS</button>
            <button onclick="recordVoice('${char}')">Record Voice</button>
            <audio id="audio-${char}" controls style="display: none;"></audio>
        `;
        voicesList.appendChild(div);
    });
}

function generateVoice(character) {
    voices[character] = {type: 'generated'};
    alert(`TTS set for ${character}`);
}

function recordVoice(character) {
    document.getElementById('record-character').textContent = character;
    document.getElementById('voice-setup').style.display = 'none';
    document.getElementById('record-section').style.display = 'block';
}

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = event => recordedChunks.push(event.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, {type: 'audio/webm'});
        const url = URL.createObjectURL(blob);
        document.getElementById('recorded-audio').src = url;
        document.getElementById('recorded-audio').style.display = 'block';
        document.getElementById('save-voice-btn').style.display = 'block';
        voices[document.getElementById('record-character').textContent] = {type: 'recorded', audio: blob};
    };
    mediaRecorder.start();
    document.getElementById('start-record-btn').disabled = true;
    document.getElementById('stop-record-btn').disabled = false;
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById('start-record-btn').disabled = false;
    document.getElementById('stop-record-btn').disabled = true;
}

function saveVoice() {
    document.getElementById('record-section').style.display = 'none';
    document.getElementById('voice-setup').style.display = 'block';
}

function startMemorization() {
    document.getElementById('voice-setup').style.display = 'none';
    document.getElementById('playback-section').style.display = 'block';
    currentIndex = 0;
    showCurrentLine();
}

async function showCurrentLine() {
    if (currentIndex >= script.length) {
        alert('Script finished!');
        return;
    }
    const line = script[currentIndex];
    document.getElementById('current-line').textContent = `${line.character}: ${line.dialogue}`;
    if (line.character === userCharacter) {
        document.getElementById('user-input').style.display = 'block';
    } else {
        document.getElementById('user-input').style.display = 'none';
        // Play the voice if available
        if (voices[line.character]) {
            if (voices[line.character].type === 'generated') {
                const utterance = new SpeechSynthesisUtterance(line.dialogue);
                utterance.onend = () => nextLine();
                speechSynthesis.speak(utterance);
            } else {
                const audio = new Audio(URL.createObjectURL(voices[line.character].audio));
                audio.play();
                audio.onended = () => nextLine();
            }
        } else {
            nextLine();
        }
    }
}

function playScript() {
    showCurrentLine();
}

function pauseScript() {
    // Pause current audio if playing
}

function nextLine() {
    currentIndex++;
    showCurrentLine();
}

function submitLine() {
    // For now, just next
    nextLine();
}