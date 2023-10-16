import * as THREE from 'three';
import * as d3 from 'd3';
import * as gsap from 'gsap';
import ThreeGlobe from 'three-globe';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
let width = 1200;
let height = 800;

let baseUrl = './'

if(window.location.host.includes('github')){
	baseUrl = '/globe/'
}

const mouse = new THREE.Vector2();
let mouseLight;

function onMouseMove(event) {
	mouse.x = (event.clientX / width) * 2 - 1;
	mouse.y = -(event.clientY / height) * 2 + 1;
}

const setupScene = () => {
	const scene = new THREE.Scene();
	return scene;
}

const setupCamera = () => {
	const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
	camera.position.z = 220;

	return camera;
}

const getPolygonColor = () => {
	const r = Math.random()
	if (r >= 0.5) {
		return '#c7e7f7';
	}
	return '#f0f0f0';
}

const setupClouds = (scene, globe) => {
	const CLOUDS_IMG_URL = '../public/clouds.png'; // from https://github.com/turban/webgl-earth
	const CLOUDS_ALT = 0.08;
	const CLOUDS_ROTATION_SPEED = -0.008; // deg/frame

	const clouds = new THREE.Mesh(new THREE.SphereGeometry(globe.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75));
	new THREE.TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
		clouds.material = new THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true });
	});

	(function rotateClouds() {
		clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
		requestAnimationFrame(rotateClouds);
	})();

	scene.add(clouds)
}

const setupHexGlobe = (globe) => {
	// const globeMaterial = new THREE.MeshPhysicalMaterial({
	//     roughness: 0,
	//     transmission: 0,
	//     metalness: 1,
	//     // clearcoat: 1,
	//     // thickness: 1, // Add refraction!
	//     color: '#ffffff',
	//     reflectivity: 0, // Max reflectivity
	// })
	// const globeMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' })
	// const globeMaterial = new THREE.MeshBasicMaterial({ color: '#201df1' })
	const globeMaterial = new THREE.MeshPhongMaterial({
		color: 0x007BFF, // choose a color you like
		shininess: 10, // adjust for desired shininess
		specular: 0xffffff, // color of the specular reflection
	});
	;
	fetch('../public/countries.geo.json').then((response) => response.json()).then((countries) => {
		globe.hexPolygonsData(countries.features)
			.hexPolygonResolution(3)
			.hexPolygonMargin(0.3)
			.hexPolygonCurvatureResolution(3)
			.hexPolygonResolution(() => 3)
			.hexPolygonCurvatureResolution(() => 8)
			.hexPolygonMargin(() => 0.5)
			.hexPolygonColor(() => getPolygonColor())
			.showAtmosphere(false)
			.atmosphereColor('lightskyblue')
			.globeMaterial(globeMaterial)
	})
}

const setupGlassShield = (scene, globe) => {
	const geometry = new THREE.SphereGeometry(globe.getGlobeRadius() + 20, 64, 64);
	const material = new THREE.MeshPhysicalMaterial({
		roughness: 0,
		transmission: 1,
		clearcoat: 1,
		thickness: 1, // Add refraction!
		color: 'lightblue',
		reflectivity: 1, // Max reflectivity
	});
	const mesh = new THREE.Mesh(geometry, material)
	scene.add(mesh);
}

const setupRealisticGlobe = (globe) => {
	globe.globeImageUrl(baseUrl+'public/earth-blue-marble.jpg')
		.bumpImageUrl(baseUrl+'public/earth-topology.png');
	let globeMaterial = globe.globeMaterial();
	globeMaterial.bumpScale = 10;
	new THREE.TextureLoader().load(baseUrl+'public/earth-water.png', texture => {
		globeMaterial.specularMap = texture;
		globeMaterial.specular = new THREE.Color('grey');
		globeMaterial.shininess = 15;
	});
}

const setupPrecipitation = (globe) => {
	const weightColor = d3.scaleLinear()
		.domain([0, 60])
		.range(['lightgreen', 'orange'])
		.clamp(true);

	const altitude = { val: 0.00 }
	let earthquakeData;
	globe
		.hexBinPointLat(d => d.geometry.coordinates[1])
		.hexBinPointLng(d => d.geometry.coordinates[0])
		.hexBinPointWeight(d => d.properties.mag)
		.hexBinResolution(3.8)
		.hexAltitude(({ sumWeight }) => sumWeight * 0.0025 > 0.08 ? 0.15 : sumWeight * 0.0025)
		.hexTopColor(d => weightColor(d.sumWeight))
		.hexSideColor(d => weightColor(d.sumWeight))
		.hexTransitionDuration(0)

	fetch('//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson').then(res => res.json()).then(
		equakes => {
			earthquakeData = equakes
			globe.hexBinPointsData(equakes.features);
		}
	);

	setInterval(() => {
		globe.hexBinPointsData([])
		setTimeout(() => {
			globe.hexBinPointsData(earthquakeData.features);
		}, 200)
	}, 4000)

}

const setupBackground = (scene) => {
	scene.background = new THREE.Color('#ffffff')
	const geometry = new THREE.PlaneGeometry(400, 400);
	const material = new THREE.MeshPhysicalMaterial({
		roughness: 0.2,
		metalness: 1,
		clearcoat: 1.0,
		clearcoatRoughness: 0.2,
		reflectivity: 1
	});
	const background = new THREE.Mesh(geometry, material);
	background.position.z = -50;  // adjust this value as needed
	// scene.add(background);
	return background;
}

const setupGlobe = (scene) => {
	const N = 30;
	const ringsData = [...Array(N).keys()].map(() => ({
		lat: (Math.random() - 0.5) * 180,
		lng: (Math.random() - 0.5) * 360,
		maxR: 4,
		propagationSpeed: 1,
		repeatPeriod: 500
	}));
	const colorInterpolator = (t) => `rgba(255,100,50,${1 - t})`;
	const globe = new ThreeGlobe()
	setupHexGlobe(globe)
	// setupRealisticGlobe(globe)
	globe.ringsData(ringsData)
		.ringColor(() => colorInterpolator)
		.ringMaxRadius('maxR')
		.ringPropagationSpeed('propagationSpeed')
		.ringAltitude(0.01)
		.ringRepeatPeriod('repeatPeriod');

	setupPrecipitation(globe)

	scene.add(globe)
	return globe;
}

const setupRingShield = (scene) => {
	const shieldRing = { lat: 90, lng: 0 };

	const globe = new ThreeGlobe()
		.showGlobe(false)
		.ringsData([shieldRing])
		.ringAltitude(0.2)
		.ringColor(() => 'lightskyblue')
		.ringMaxRadius(180)
		.ringPropagationSpeed(10)
		.ringRepeatPeriod(100)
	scene.add(globe)
}

const setupLighting = (scene, globe) => {
	scene.add(new THREE.AmbientLight(0xcccccc, 2));
	mouseLight = new THREE.PointLight(0xffffff, 60, 2500);
	mouseLight.position.z = 150;
	scene.add(mouseLight);
	const sphereSize = 1;
	const pointLightHelper = new THREE.PointLightHelper(mouseLight, sphereSize);
	scene.add(pointLightHelper);

	const light1 = new THREE.PointLight(0xffffff, 1000, 100); // Red light
	light1.position.set(80, 80, 80);
	scene.add(light1);
	const pointLightHelper1 = new THREE.PointLightHelper(light1, 4);
	scene.add(pointLightHelper1);

	const light2 = new THREE.PointLight(0xffffff, 1000, 100); // Green light
	light2.position.set(-80, -80, 80);
	scene.add(light2);

	const light3 = new THREE.PointLight(0xffffff, 1000, 100); // Blue light
	light3.position.set(80, -80, -80);
	scene.add(light3);
}


const onDocumentMouseDown = () => {
	if (!globe) {
		return;
	}
	gsap.to(globe.scale, { x: 0.95, y: 0.9, z: 0.9, duration: 0.3, ease: "power2.out" });
};

const onDocumentMouseUp = () => {
	if (!globe) {
		return;
	}
	gsap.to(globe.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: "power2.out" });
};

const setupControls = (camera, canvas) => {
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.update()
	controls.autoRotate = true;
	controls.autoRotateSpeed = 0.5;
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.minPolarAngle = Math.PI / 2.5;
	controls.maxPolarAngle = Math.PI / 1.5;

	return controls
}


const scene = setupScene();
const background = setupBackground(scene);

const camera = setupCamera();

const element = document.getElementById("globeViz")

const renderer = new THREE.WebGLRenderer({
	canvas: element
});

renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.8
renderer.setPixelRatio(Math.min(window.devicePixelRatio * .7, 2))
renderer.transmissionSampleCount = 100
// document.body.appendChild(renderer.domElement);f
const globe = setupGlobe(scene)

setupLighting(scene, globe);
setupClouds(scene, globe)
// setupGlassShield(scene, globe)

// setupRingShield(scene)

const controls = setupControls(camera, renderer.domElement)


const animate = () => {
	requestAnimationFrame(animate);

	const raycaster = new THREE.Raycaster();
	const distanceFromCamera = 100;  // this value will determine how far from the camera the light will be
	raycaster.setFromCamera(mouse, camera);
	mouseLight.position.set(raycaster.ray.origin.x + raycaster.ray.direction.x * distanceFromCamera,
		raycaster.ray.origin.y + raycaster.ray.direction.y * distanceFromCamera,
		raycaster.ray.origin.z + raycaster.ray.direction.z * distanceFromCamera);
	controls.update()
	background.material.envMapIntensity = 0.5 + 0.5 * Math.sin(0.1 * Date.now());

	const offset = 50;  // distance from the camera
	background.position.copy(camera.position);
	background.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-offset));
	background.lookAt(camera.position);
	renderer.render(scene, camera);
};

function init() {
	document.addEventListener('pointerdown', onDocumentMouseDown);
	document.addEventListener('pointerup', onDocumentMouseUp);
	document.addEventListener('mousemove', onMouseMove, false);

	animate();
}


init()
