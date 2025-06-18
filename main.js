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

const sound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();
audioLoader.load("/bicep_apricots.mp3", function (buffer) {
  sound.setBuffer(buffer);
  window.addEventListener("click", function () {
    sound.play();
    // Transition the text island to show buttons
    const textIsland = document.getElementById("text-island");
    const islandText = document.getElementById("island-text");
    const islandButtons = document.getElementById("island-buttons");
    if (islandText && islandButtons) {
      islandText.style.display = "none";
      islandButtons.style.display = "flex";
    }
  });

  // Optionally, fade out the island if 'END CALL' is clicked
  const endCallBtn = document.getElementById("end-call-btn");
  if (endCallBtn) {
    endCallBtn.addEventListener("click", function () {
      const textIsland = document.getElementById("text-island");
      if (textIsland) {
        textIsland.classList.add("playing");
      }
    });
  }
});

const analyser = new THREE.AudioAnalyser(sound, 32);

// Create the parameters object
const params = {
  red: 0.302, // 77/255
  green: 0.886, // 226/255
  blue: 0.961, // 245/255
  threshold: 0.5,
  strength: 0.5,
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

const geo = new THREE.IcosahedronGeometry(4, 30);
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

const clock = new THREE.Clock();

function animate() {
  // Dynamic camera movement
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.5;
  camera.lookAt(scene.position);

  uniforms.u_frequency.value = analyser.getAverageFrequency();
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
