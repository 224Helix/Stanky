let script = [];
let characters = [];
let userCharacter = '';
let voices = {}; // character -> {type: 'generated'}
let currentIndex = 0;

document.getElementById('upload-btn').addEventListener('click', uploadScript);
document.getElementById('select-character-btn').addEventListener('click', selectCharacter);
document.getElementById('start-memorization-btn').addEventListener('click', startMemorization);
document.getElementById('next-btn').addEventListener('click', nextLine);

async function uploadScript() {
    const fileInput = document.getElementById('script-file');
    const file = fileInput.files[0];
    if (!file) return alert('Select a file');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`${window.API_BASE}/upload-script`, {
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
            alert('No characters found in the uploaded script. The parser may be too strict or the uploaded .txt may not follow the required format.');
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
    // show a simple list of other characters (no per-character buttons)
    characters.filter(c => c !== userCharacter).forEach(char => {
        const div = document.createElement('div');
        div.className = 'voice-item';
        div.textContent = char;
        voicesList.appendChild(div);
    });

    // wire the "TTS for all" checkbox behavior
    const ttsAll = document.getElementById('tts-for-all');
    // default to true for convenience
    if (ttsAll) {
        if (Object.keys(voices).length === 0) ttsAll.checked = true;
        ttsAll.onchange = () => {
            if (ttsAll.checked) {
                // set generated TTS for all non-user characters
                characters.filter(c => c !== userCharacter).forEach(c => voices[c] = {type: 'generated'});
            } else {
                // clear generated voices (keep user empty)
                characters.filter(c => c !== userCharacter).forEach(c => { delete voices[c]; });
            }
        };
        // trigger initial setting if checked
        if (ttsAll.checked) {
            characters.filter(c => c !== userCharacter).forEach(c => voices[c] = {type: 'generated'});
        }
    }
}

// Recording/generation and per-character controls removed for a simpler UI.

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
        // user will press Next when ready
    } else {
        document.getElementById('user-input').style.display = 'none';
        // Play the voice if TTS has been enabled for this character
        if (voices[line.character] && voices[line.character].type === 'generated') {
            const utterance = new SpeechSynthesisUtterance(line.dialogue);
            utterance.onend = () => nextLine();
            speechSynthesis.speak(utterance);
        } else {
            // skip lines without a voice configured
            nextLine();
        }
    }
}

function nextLine() {
    currentIndex++;
    showCurrentLine();
}
// submitLine removed — user advances using Next