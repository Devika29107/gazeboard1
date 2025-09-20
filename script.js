// Gaze hold time threshold in ms
const HOLD_TIME = 2000;

let gazeStart = null;
let currentTarget = null;

// Start WebGazer
window.onload = () => {
  webgazer.setGazeListener((data, elapsedTime) => {
    if (!data) return;

    const x = data.x;
    const y = data.y;

    const elements = document.elementsFromPoint(x, y);
    const icon = elements.find(el => el.classList && el.classList.contains('icon'));

    if (icon !== currentTarget) {
      if (currentTarget) currentTarget.classList.remove('highlight');
      currentTarget = icon;
      gazeStart = new Date();
      if (icon) icon.classList.add('highlight');
    } else if (icon && new Date() - gazeStart > HOLD_TIME) {
      speakPhrase(icon.dataset.phrase);
      gazeStart = new Date(); // Reset so it doesn’t keep repeating
    }
  }).begin();
};

function speakPhrase(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN'; // or 'ml-IN' for Malayalam if available
  speechSynthesis.speak(utterance);
}
let blinkCount = 0;
let lastBlinkTime = 0;

// EAR helper function
function getEAR(landmarks, left=true) {
  const [a, b, c, d, e, f] = left
    ? [33, 160, 158, 133, 153, 144] // Left eye landmarks
    : [362, 385, 387, 263, 380, 373]; // Right eye

  const distV = (p1, p2) => Math.hypot(
    landmarks[p1].x - landmarks[p2].x,
    landmarks[p1].y - landmarks[p2].y
  );

  const vertical = (distV(b, f) + distV(c, e)) / 2;
  const horizontal = distV(a, d);
  return vertical / horizontal;
}

// Set up MediaPipe
const video = document.createElement('video');
video.style.display = 'none';
document.body.appendChild(video);

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });
faceMesh.onResults(results => {
  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    const leftEAR = getEAR(landmarks, true);
    const rightEAR = getEAR(landmarks, false);
    const avgEAR = (leftEAR + rightEAR) / 2;

    const now = Date.now();
    if (avgEAR < 0.22) { // Blink threshold
      if (now - lastBlinkTime < 400) {
        blinkCount++;
        if (blinkCount >= 2) {
          triggerSOS();
          blinkCount = 0;
        }
      }
      lastBlinkTime = now;
    }
  }
});

// Setup webcam for MediaPipe
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();

function triggerSOS() {
  document.getElementById("sos-alert").style.display = "block";
  speakPhrase("Help me!");
  setTimeout(() => {
    document.getElementById("sos-alert").style.display = "none";
  }, 3000);
}
