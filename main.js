import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Sets the color of the background.
// renderer.setClearColor(0xfefefe);

// Set the output color space for post-processing
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// Camera positioning.
camera.position.set(6, 8, 14);

// Mouse tracking for dynamic camera movement
let mouseX = 0;
let mouseY = 0;
document.addEventListener("mousemove", function (e) {
  let windowHalfX = window.innerWidth / 2;
  let windowHalfY = window.innerHeight / 2;
  mouseX = (e.clientX - windowHalfX) / 100;
  mouseY = (e.clientY - windowHalfY) / 100;
});

const listener = new THREE.AudioListener();
camera.add(listener);
let analyser = null; // global
let micStream = null; // store the MediaStream
let audioContext = null; // Web Audio context
let micSource = null; // MediaStreamAudioSourceNode
let targetFrequency = 0; // for smooth transition

const sound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();
audioLoader.load("/bicep_apricots.mp3", function (buffer) {
  sound.setBuffer(buffer);

  // Helper to check if the island is in initial state
  function isIslandInitial() {
    const islandText = document.getElementById("island-text");
    return islandText && islandText.style.display !== "none";
  }

  // Set clickable class on island in initial state
  function updateIslandClickable() {
    const textIsland = document.getElementById("text-island");
    if (!textIsland) return;
    if (isIslandInitial()) {
      textIsland.classList.add("clickable");
    } else {
      textIsland.classList.remove("clickable");
    }
  }

  // Microphone access function
  function requestMicrophoneAccess() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        micStream = stream;
        console.log("Microphone access granted!", stream);
        // Create or reuse AudioContext
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume AudioContext if suspended
        if (audioContext.state === "suspended") {
          audioContext.resume().then(() => {
            console.log("AudioContext resumed");
          });
        }
        // Create MediaStreamSource and AnalyserNode
        micSource = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // 32 bins, similar to previous
        micSource.connect(analyser);
        // Do NOT connect to audioContext.destination (no echo)
        // Test frequency data
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        setTimeout(() => {
          analyser.getByteFrequencyData(freqData);
          console.log("Test Web Audio API frequency data:", freqData);
        }, 1000);
      })
      .catch(function (err) {
        console.error("Microphone access denied:", err);
        alert("Microphone access denied. Please allow microphone access to use the visualizer.");
      });
  }

  // Initial clickable state
  updateIslandClickable();

  // Click handler for the island
  const textIsland = document.getElementById("text-island");
  if (textIsland) {
    textIsland.addEventListener("click", function (e) {
      if (isIslandInitial()) {
        requestMicrophoneAccess();
        // Transition the text island to show buttons
        const islandText = document.getElementById("island-text");
        const islandButtons = document.getElementById("island-buttons");
        if (islandText && islandButtons) {
          islandText.style.display = "none";
          islandButtons.style.display = "flex";
        }
        updateIslandClickable();
        e.stopPropagation(); // Prevent window click from firing too
      }
    });
  }

  // Global click handler for background
  window.addEventListener("click", function (e) {
    // Only start audio if not clicking on the text island or its children
    const textIsland = document.getElementById("text-island");
    if (textIsland && textIsland.contains(e.target)) {
      // Let the island handle its own click
      return;
    }
    if (isIslandInitial()) {
      requestMicrophoneAccess();
      // Transition the text island to show buttons
      const islandText = document.getElementById("island-text");
      const islandButtons = document.getElementById("island-buttons");
      if (islandText && islandButtons) {
        islandText.style.display = "none";
        islandButtons.style.display = "flex";
      }
      updateIslandClickable();
    }
  });

  // END CALL button logic
  const endCallBtn = document.getElementById("end-call-btn");
  if (endCallBtn) {
    endCallBtn.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent window click handler from firing
      // Stop and reset audio (not needed for mic, but reset UI)
      // Stop the mic stream if it exists
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = null;
        analyser = null;
        console.log("Microphone stream stopped and analyser reset.");
      }
      // Restore UI to initial state
      const textIsland = document.getElementById("text-island");
      const islandText = document.getElementById("island-text");
      const islandButtons = document.getElementById("island-buttons");
      if (textIsland) {
        textIsland.classList.remove("playing");
      }
      if (islandText && islandButtons) {
        islandText.style.display = "inline";
        islandButtons.style.display = "none";
      }
      updateIslandClickable();
    });
  }
});

// Create the parameters object
const params = {
  red: 0.302, // 77/255
  green: 0.886, // 226/255
  blue: 0.961, // 245/255
  threshold: 0.5,
  strength: 0.3,
  radius: 0.1,
};

// Create post-processing passes
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight));
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const outputPass = new OutputPass();

// Create the composer
const bloomComposer = new EffectComposer(renderer);

// Add the passes
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);
bloomComposer.addPass(outputPass);

const uniforms = {
  u_time: { value: 0.0 },
  u_frequency: { value: 0.0 },
  u_red: { value: params.red },
  u_green: { value: params.green },
  u_blue: { value: params.blue },
};

const mat = new THREE.ShaderMaterial({
  wireframe: true,
  uniforms,
  vertexShader: document.getElementById("vertexshader").textContent,
  fragmentShader: document.getElementById("fragmentshader").textContent,
});

const geo = new THREE.IcosahedronGeometry(2.5, 30);
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

const clock = new THREE.Clock();

const THRESHOLD = 40; // Sensitivity threshold for average frequency

function getAverageFrequencyFromAnalyser(analyser) {
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for (let i = 0; i < freqData.length; i++) {
    sum += freqData[i];
  }
  return sum / freqData.length;
}

function animate() {
  // Dynamic camera movement
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.5;
  camera.lookAt(scene.position);

  // Use analyser if available
  if (analyser) {
    let avg = getAverageFrequencyFromAnalyser(analyser);
    targetFrequency = avg > THRESHOLD ? avg : 0;
  } else {
    targetFrequency = 0.0;
  }
  // Smoothly interpolate (lerp) the frequency value
  uniforms.u_frequency.value += (targetFrequency - uniforms.u_frequency.value) * 0.07;

  uniforms.u_time.value = clock.getElapsedTime();
  bloomComposer.render();
  requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
});
