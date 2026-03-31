<svelte:options runes={false} />

<script>
  // @ts-nocheck
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  let container;
  let loadState = "Loading anatomy model...";
  let selectMode = false;
  let selectedLabel = "Rotate, drag, and zoom to inspect the body.";
  let ready = false;

  let resetCamera = () => {};
  let clearPainPoints = () => {};

  function formatPainSummary(areas) {
    return areas.length
      ? `Area of pain: ${areas.join("; ")}`
      : "Rotate the body, zoom into a region, and switch on selection mode when you want to start marking painful muscle areas.";
  }

  function getPrimaryMaterial(mesh) {
    return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  }

  function getRegionLabel(mesh, point, modelRoot, modelBounds) {
    const material = getPrimaryMaterial(mesh);
    const materialName = material?.name?.trim();
    const meshName = mesh?.name?.trim();

    if (materialName && materialName !== "Muscles.001") {
      return materialName;
    }

    if (meshName && !meshName.startsWith("Object_")) {
      return meshName;
    }

    if (!point || !modelRoot || !modelBounds) {
      return "Muscle region";
    }

    const localPoint = modelRoot.worldToLocal(point.clone());
    const xMid = (modelBounds.minX + modelBounds.maxX) / 2;
    const zMid = (modelBounds.minZ + modelBounds.maxZ) / 2;
    const xRelative = modelBounds.sizeX
      ? (localPoint.x - xMid) / (modelBounds.sizeX / 2)
      : 0;
    const yRelative = modelBounds.sizeY
      ? (localPoint.y - modelBounds.minY) / modelBounds.sizeY
      : 0;
    const zRelative = modelBounds.sizeZ
      ? (localPoint.z - zMid) / (modelBounds.sizeZ / 2)
      : 0;
    const side =
      xRelative < -0.18 ? "left" : xRelative > 0.18 ? "right" : "center";
    const regionDepth =
      zRelative > 0.18 ? "front" : zRelative < -0.18 ? "back" : "side";

    function withSide(label) {
      return side === "center" ? label : `${side} ${label}`;
    }

    if (yRelative > 0.9) return withSide("upper trapezius");

    if (
      yRelative > 0.5 &&
      yRelative < 0.84 &&
      Math.abs(xRelative) > 0.45
    ) {
      if (regionDepth === "front") {
        return withSide(yRelative > 0.72 ? "deltoid" : "biceps");
      }
      if (regionDepth === "back") {
        return withSide(yRelative > 0.72 ? "posterior deltoid" : "triceps");
      }
      return withSide("brachialis");
    }

    if (yRelative > 0.79) {
      if (Math.abs(xRelative) > 0.5) {
        return regionDepth === "back" ? withSide("posterior deltoid") : withSide("deltoid");
      }
      if (regionDepth === "front") return "pectoralis major";
      if (regionDepth === "back") return "trapezius";
      return withSide("deltoid");
    }

    if (yRelative > 0.66) {
      if (regionDepth === "front") {
        return Math.abs(xRelative) > 0.26
          ? withSide("serratus anterior")
          : "pectoralis major";
      }
      if (regionDepth === "back") {
        return Math.abs(xRelative) > 0.26
          ? withSide("latissimus dorsi")
          : "rhomboids";
      }
      return withSide("external oblique");
    }

    if (yRelative > 0.52) {
      if (Math.abs(xRelative) > 0.78) {
        return regionDepth === "back" ? withSide("triceps") : withSide("biceps");
      }
      if (regionDepth === "front") {
        return Math.abs(xRelative) > 0.32
          ? withSide("external oblique")
          : "rectus abdominis";
      }
      if (regionDepth === "back") {
        return Math.abs(xRelative) > 0.32
          ? withSide("latissimus dorsi")
          : "erector spinae";
      }
      return withSide("external oblique");
    }

    if (yRelative > 0.4) {
      if (Math.abs(xRelative) > 0.42) {
        return regionDepth === "back"
          ? withSide("gluteus medius")
          : withSide("hip flexors");
      }
      return regionDepth === "back"
        ? "erector spinae"
        : "lower rectus abdominis";
    }

    if (yRelative > 0.24) {
      if (regionDepth === "front") {
        return Math.abs(xRelative) > 0.25
          ? withSide("adductors")
          : "quadriceps";
      }
      if (regionDepth === "back") {
        return Math.abs(xRelative) > 0.25
          ? withSide("hamstrings")
          : "hamstrings";
      }
      return withSide("hip abductors");
    }

    if (yRelative > 0.12) {
      if (regionDepth === "front") {
        return Math.abs(xRelative) > 0.18
          ? withSide("vastus medialis")
          : "patellar tendon";
      }
      if (regionDepth === "back") {
        return Math.abs(xRelative) > 0.18
          ? withSide("gastrocnemius")
          : "gastrocnemius";
      }
      return withSide("iliotibial band");
    }

    if (regionDepth === "front") {
      return Math.abs(xRelative) > 0.18
        ? withSide("tibialis anterior")
        : "tibialis anterior";
    }

    if (regionDepth === "back") {
      return Math.abs(xRelative) > 0.18
        ? withSide("gastrocnemius")
        : "Achilles tendon";
    }

    return withSide("lower leg");
  }

  onMount(() => {
    let renderer;
    let scene;
    let camera;
    let controls;
    let frameId;
    let resizeObserver;
    let loadedRoot;
    let hoverHit = null;
    let initialCameraPosition;
    let initialTarget;
    let painMarkers = [];
    let selectedAreas = [];
    let modelBounds = null;

    const cleanup = [];

    async function setup() {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const { DecalGeometry } = await import(
        "three/examples/jsm/geometries/DecalGeometry.js"
      );

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#f6f0e6");
      scene.fog = new THREE.Fog("#f6f0e6", 18, 38);

      camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
      camera.position.set(0, 1.4, 9);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = "viewer-canvas";
      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.minDistance = 1.15;
      controls.maxDistance = 15;
      controls.zoomSpeed = 1.15;
      controls.enablePan = true;
      controls.panSpeed = 0.8;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      };
      controls.target.set(0, 1.1, 0);

      const ambient = new THREE.HemisphereLight("#fff6e9", "#d8d2c8", 1.8);
      scene.add(ambient);

      const key = new THREE.DirectionalLight("#fffaf0", 2.1);
      key.position.set(6, 10, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      scene.add(key);

      const fill = new THREE.DirectionalLight("#d3e4ff", 1.1);
      fill.position.set(-7, 5, 6);
      scene.add(fill);

      const rim = new THREE.DirectionalLight("#ffd7c2", 0.9);
      rim.position.set(0, 6, -8);
      scene.add(rim);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 64),
        new THREE.MeshStandardMaterial({
          color: "#dcd3c6",
          transparent: true,
          opacity: 0.55,
          roughness: 0.95,
          metalness: 0,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -4.35;
      floor.receiveShadow = true;
      scene.add(floor);

      const loader = new GLTFLoader();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const selectableMeshes = [];
      const modelUrl = new URL("/myology/scene.gltf", window.location.origin);

      function createPainMarker(hit) {
        const marker = new THREE.Group();
        const worldNormal = hit.face?.normal
          ?.clone()
          .transformDirection(hit.object.matrixWorld);
        const markerNormal = worldNormal?.lengthSq()
          ? worldNormal.normalize()
          : camera.position.clone().sub(hit.point).normalize();
        const projector = new THREE.Object3D();
        projector.position.copy(hit.point);
        projector.lookAt(hit.point.clone().add(markerNormal));
        projector.rotateZ(Math.PI * 0.2);

        const outerGeometry = new DecalGeometry(
          hit.object,
          hit.point,
          projector.rotation,
          new THREE.Vector3(0.28, 0.28, 0.26),
        );
        const outerMaterial = new THREE.MeshStandardMaterial({
          color: "#ff8f7b",
          emissive: "#ffb2a5",
          emissiveIntensity: 0.28,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          roughness: 0.7,
          metalness: 0,
        });
        const outerHighlight = new THREE.Mesh(outerGeometry, outerMaterial);

        const innerGeometry = new DecalGeometry(
          hit.object,
          hit.point,
          projector.rotation,
          new THREE.Vector3(0.16, 0.16, 0.22),
        );
        const innerMaterial = new THREE.MeshStandardMaterial({
          color: "#ff6b57",
          emissive: "#ff9b8d",
          emissiveIntensity: 0.42,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          roughness: 0.55,
          metalness: 0,
        });
        const innerHighlight = new THREE.Mesh(innerGeometry, innerMaterial);

        marker.add(outerHighlight);
        marker.add(innerHighlight);
        scene.add(marker);

        return marker;
      }

      function resize() {
        if (!container || !renderer || !camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      function updateInteractionState(nextHover) {
        hoverHit = nextHover;

        renderer.domElement.style.cursor =
          selectMode && hoverHit ? "crosshair" : selectMode ? "copy" : "grab";
      }

      function syncAreas() {
        selectedLabel = formatPainSummary(selectedAreas);
        dispatch("areaschange", { areas: [...selectedAreas] });
      }

      clearPainPoints = () => {
        for (const marker of painMarkers) {
          scene.remove(marker);
          marker.traverse((child) => {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          });
        }

        painMarkers = [];
        selectedAreas = [];
        syncAreas();
      };

      function handlePointerMove(event) {
        if (!selectMode || !renderer || !camera) {
          updateInteractionState(null);
          return;
        }

        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(selectableMeshes, false)[0];
        updateInteractionState(hit ?? null);
      }

      function handlePointerLeave() {
        updateInteractionState(null);
      }

      function handleSelect() {
        if (!selectMode || !hoverHit) return;

        painMarkers = [...painMarkers, createPainMarker(hoverHit)];

        const areaLabel = getRegionLabel(
          hoverHit.object,
          hoverHit.point,
          loadedRoot,
          modelBounds,
        );
        if (!selectedAreas.includes(areaLabel)) {
          selectedAreas = [...selectedAreas, areaLabel];
        }

        syncAreas();
      }

      async function loadModel(attempt = 1) {
        try {
          const url = new URL(modelUrl);
          if (attempt > 1) {
            url.searchParams.set("retry", String(attempt));
          }

          loadState =
            attempt > 1
              ? "Retrying anatomy model load..."
              : "Loading anatomy model...";

          const gltf = await loader.loadAsync(url.toString());
          loadedRoot = gltf.scene;

          loadedRoot.traverse((child) => {
            if (!child.isMesh) return;

            child.castShadow = true;
            child.receiveShadow = true;

            const materialName = getPrimaryMaterial(child)?.name ?? "";
            if (materialName === "Muscles.001") {
              selectableMeshes.push(child);
            }
          });

          const bounds = new THREE.Box3().setFromObject(loadedRoot);
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          modelBounds = {
            minX: bounds.min.x,
            maxX: bounds.max.x,
            minY: bounds.min.y,
            maxY: bounds.max.y,
            minZ: bounds.min.z,
            maxZ: bounds.max.z,
            sizeX: size.x,
            sizeY: size.y,
            sizeZ: size.z,
          };

          loadedRoot.position.sub(center);
          loadedRoot.position.y -= size.y * 0.08;
          scene.add(loadedRoot);

          const maxAxis = Math.max(size.x, size.y, size.z);
          const fitDistance = maxAxis * 1.28;
          camera.position.set(0, size.y * 0.12, fitDistance);
          controls.target.set(0, size.y * 0.04, 0);
          controls.update();

          initialCameraPosition = camera.position.clone();
          initialTarget = controls.target.clone();
          resetCamera = () => {
            camera.position.copy(initialCameraPosition);
            controls.target.copy(initialTarget);
            controls.update();
          };

          loadState = "";
          ready = true;
          selectedLabel = formatPainSummary(selectedAreas);
          resize();
        } catch (error) {
          console.error("Failed to load anatomy model", error);

          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            return loadModel(attempt + 1);
          }

          const message =
            error?.message ||
            error?.target?.statusText ||
            error?.target?.responseURL ||
            "unknown loading error";

          loadState = `The anatomy model could not be loaded (${message}).`;
        }
      }

      loadModel();

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.addEventListener("click", handleSelect);

      cleanup.push(() =>
        renderer.domElement.removeEventListener(
          "pointermove",
          handlePointerMove,
        ),
      );
      cleanup.push(() =>
        renderer.domElement.removeEventListener(
          "pointerleave",
          handlePointerLeave,
        ),
      );
      cleanup.push(() =>
        renderer.domElement.removeEventListener("click", handleSelect),
      );

      function animate() {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }

      animate();
    }

    setup();

    return () => {
      cleanup.forEach((fn) => fn());
      if (resizeObserver) resizeObserver.disconnect();
      if (frameId) cancelAnimationFrame(frameId);

      if (loadedRoot) {
        loadedRoot.traverse((child) => {
          if (!child.isMesh) return;
          child.geometry?.dispose?.();
        });
      }

      for (const marker of painMarkers) {
        marker.traverse((child) => {
          child.geometry?.dispose?.();
          child.material?.dispose?.();
        });
      }

      controls?.dispose();
      renderer?.dispose();
    };
  });
</script>

<div class="viewer-card">
  <div class="viewer-toolbar">
    <div>
      <p class="eyebrow">3D Body Map</p>
      <h2>Muscle Explorer</h2>
    </div>
    <div class="toolbar-actions">
      <button
        type="button"
        class:selected={selectMode}
        onclick={() => {
          selectMode = !selectMode;
          selectedLabel = selectMode
            ? "Selection mode on. Click the body to paint the painful area."
            : formatPainSummary(selectedAreas);
        }}
      >
        {selectMode ? "Selecting" : "Select"}
      </button>
      <button type="button" class="ghost" onclick={clearPainPoints}>
        Clear Points
      </button>
      <button type="button" class="ghost" onclick={() => resetCamera()}>
        Reset View
      </button>
    </div>
  </div>

  <div bind:this={container} class="viewer-shell">
    {#if loadState}
      <div class="viewer-status">{loadState}</div>
    {/if}

    <div class="viewer-info-panel" class:ready={ready}>
      <p class="viewer-info-copy">{selectedLabel}</p>
      <p class="credit">
        3D model based on "Myology" by Z-Anatomy, licensed CC-BY-SA 4.0.
      </p>
    </div>
  </div>
</div>

<style>
  .viewer-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: radial-gradient(
        circle at top left,
        rgba(255, 240, 224, 0.9),
        transparent 36%
      ),
      linear-gradient(
        165deg,
        rgba(255, 252, 247, 0.98),
        rgba(239, 232, 220, 0.94)
      );
    border: 1px solid rgba(70, 58, 46, 0.14);
    border-radius: 20px;
    padding: 14px;
    box-shadow:
      0 28px 80px rgba(38, 26, 10, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(14px);
  }

  .viewer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .eyebrow {
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #7c6956;
    margin-bottom: 6px;
  }

  h2 {
    font-size: clamp(1.5rem, 2vw, 2.1rem);
    font-weight: 500;
    color: #27190d;
    line-height: 1;
  }

  .toolbar-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .toolbar-actions button {
    border: none;
    border-radius: 999px;
    padding: 11px 16px;
    font: inherit;
    font-size: 0.86rem;
    cursor: pointer;
    background: #2f1f12;
    color: #fff6e8;
    transition:
      transform 0.18s ease,
      opacity 0.18s ease,
      background 0.18s ease;
  }

  .toolbar-actions button:hover {
    transform: translateY(-1px);
    opacity: 0.92;
  }

  .toolbar-actions button.selected {
    background: #b55425;
  }

  .toolbar-actions button.ghost {
    background: rgba(49, 33, 19, 0.08);
    color: #352417;
  }

  .viewer-shell {
    position: relative;
    min-height: 620px;
    border-radius: 22px;
    overflow: hidden;
    background: radial-gradient(
        circle at 50% 22%,
        rgba(255, 246, 232, 0.84),
        transparent 38%
      ),
      linear-gradient(180deg, #fff7eb 0%, #efe2d2 100%);
    border: 1px solid rgba(80, 60, 40, 0.12);
  }

  .viewer-info-panel {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 249, 240, 0.92);
    border: 1px solid rgba(92, 68, 42, 0.12);
    backdrop-filter: blur(14px);
    box-shadow: 0 14px 28px rgba(50, 32, 14, 0.1);
    color: #4a3828;
    font-size: 0.9rem;
    line-height: 1.45;
    pointer-events: none;
    z-index: 2;
  }

  .viewer-info-panel.ready {
    opacity: 1;
  }

  .viewer-info-copy {
    font-weight: 500;
  }

  .credit {
    font-size: 0.78rem;
    color: #7c6956;
  }

  :global(.viewer-canvas) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .viewer-status {
    position: absolute;
    inset: 18px;
    display: grid;
    place-items: center;
    text-align: center;
    border-radius: 18px;
    background: linear-gradient(
      145deg,
      rgba(255, 251, 244, 0.96),
      rgba(240, 226, 210, 0.88)
    );
    color: #5e4a37;
    font-size: 0.96rem;
    letter-spacing: 0.02em;
    z-index: 3;
  }

  @media (max-width: 980px) {
    .viewer-shell {
      min-height: 520px;
    }
  }

  @media (max-width: 700px) {
    .viewer-card {
      border-radius: 22px;
      padding: 14px;
    }

    .viewer-toolbar {
      flex-direction: column;
    }

    .toolbar-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .viewer-shell {
      min-height: 420px;
    }

    .viewer-info-panel {
      left: 12px;
      right: 12px;
      bottom: 12px;
    }
  }
</style>
