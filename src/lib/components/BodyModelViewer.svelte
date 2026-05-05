<svelte:options runes={false} />

<script>
  // @ts-nocheck
  import { browser } from "$app/environment";
  import { base } from "$app/paths";
  import { env } from "$env/dynamic/public";
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();
  const configuredModelUrl = env.PUBLIC_MODEL_URL?.trim();
  const configuredModelRoot = env.PUBLIC_MYOLOGY_MODEL_ROOT?.trim().replace(/\/$/, "");
  const modelSourceCandidates = [
    configuredModelUrl
      ? {
          url: configuredModelUrl,
          label: configuredModelUrl,
        }
      : null,
    ...(configuredModelRoot
      ? [
          {
            url: `${configuredModelRoot}/scene.gltf`,
            label: configuredModelRoot,
          },
        ]
      : [...new Set([`${base}/myology`, "/myology"].map((path) => path.replace(/\/$/, "")))].map(
          (path) => ({
            url: `${path}/scene.gltf`,
            label: path,
          }),
        )),
  ].filter(Boolean);
  const sharedThreeModulesPromise = browser
    ? Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
      ])
    : null;

  let decalGeometryPromise;

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

  function getModelLoadErrorMessage(
    error,
    attemptedLocations = modelSourceCandidates.map((candidate) => candidate.label),
  ) {
    const rawMessage =
      error?.message || error?.target?.statusText || error?.target?.responseURL || "";
    const normalized = rawMessage.toLowerCase();
    const locationSummary = attemptedLocations.join(" or ");

    if (
      normalized.includes("404") ||
      normalized.includes("not found") ||
      normalized.includes("scene.gltf") ||
      normalized.includes("scene.bin")
    ) {
      return `The anatomy model files were not found at ${locationSummary}. Make sure the GLTF URL is public, its referenced files are reachable, and that PUBLIC_MODEL_URL or PUBLIC_MYOLOGY_MODEL_ROOT points to the correct location.`;
    }

    return `The anatomy model could not be loaded (${rawMessage || "unknown loading error"}).`;
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

    if (yRelative > 0.8 && Math.abs(xRelative) < 0.16) return "neck";

    if (yRelative > 0.9) return withSide("upper trapezius");

    if (yRelative > 0.48 && yRelative < 0.84 && Math.abs(xRelative) > 0.34) {
      if (yRelative > 0.68) {
        return regionDepth === "back"
          ? withSide("posterior deltoid")
          : withSide("deltoid");
      }

      if (yRelative < 0.58) {
        if (regionDepth === "front") {
          return withSide("forearm flexors");
        }
        if (regionDepth === "back") {
          return withSide("forearm extensors");
        }
        return withSide("forearm");
      }

      if (regionDepth === "front") {
        return withSide("biceps");
      }
      if (regionDepth === "back") {
        return withSide("triceps");
      }
      return withSide("brachialis");
    }

    if (yRelative > 0.79) {
      if (Math.abs(xRelative) > 0.6) {
        return regionDepth === "back"
          ? withSide("posterior deltoid")
          : withSide("deltoid");
      }
      if (regionDepth === "front") return "pectoralis major";
      if (regionDepth === "back") return "trapezius";
      return withSide("deltoid");
    }

    if (yRelative > 0.66) {
      if (regionDepth === "front") {
        return Math.abs(xRelative) > 0.38
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
        return regionDepth === "back"
          ? withSide("triceps")
          : withSide("biceps");
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
      if (regionDepth === "front" && yRelative < 0.47) {
        return Math.abs(xRelative) < 0.16
          ? withSide("adductors")
          : "quadriceps";
      }

      if (regionDepth === "back" && yRelative < 0.55 && Math.abs(xRelative) > 0.06) {
        return Math.abs(xRelative) > 0.22
          ? withSide("gluteus medius")
          : "gluteus maximus";
      }

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
        return Math.abs(xRelative) < 0.16
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
      const [THREE, { OrbitControls }, { GLTFLoader }] =
        await sharedThreeModulesPromise;

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
      camera.position.set(0, 1.4, 9);

      renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio <= 1.5,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
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

      const ambient = new THREE.HemisphereLight("#f4eaea", "#8f8080", 1.75);
      scene.add(ambient);

      const key = new THREE.DirectionalLight("#f7eded", 2);
      key.position.set(6, 10, 8);
      scene.add(key);

      const fill = new THREE.DirectionalLight("#d1caca", 1);
      fill.position.set(-7, 5, 6);
      scene.add(fill);

      const rim = new THREE.DirectionalLight("#8b3a3a", 0.8);
      rim.position.set(0, 6, -8);
      scene.add(rim);

      const loadingManager = new THREE.LoadingManager();
      loadingManager.onStart = () => {
        loadState = "Loading anatomy model...";
      };
      loadingManager.onProgress = (_, itemsLoaded, itemsTotal) => {
        if (itemsTotal > 0) {
          loadState = `Loading anatomy model... ${Math.round(
            (itemsLoaded / itemsTotal) * 100,
          )}%`;
        }
      };

      const loader = new GLTFLoader(loadingManager);
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const selectableMeshes = [];

      async function getDecalGeometry() {
        decalGeometryPromise ??= import(
          "three/examples/jsm/geometries/DecalGeometry.js"
        ).then((module) => module.DecalGeometry);
        return decalGeometryPromise;
      }

      async function createPainMarker(hit) {
        const DecalGeometry = await getDecalGeometry();
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
          color: "#9f5454",
          emissive: "#6e0505",
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
          color: "#6e0505",
          emissive: "#8f2b2b",
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

      async function handleSelect() {
        if (!selectMode || !hoverHit) return;

        const marker = await createPainMarker(hoverHit);
        painMarkers = [...painMarkers, marker];

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

      async function loadModel() {
        let lastError;

        for (const [sourceIndex, modelSource] of modelSourceCandidates.entries()) {
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              const url = new URL(modelSource.url, window.location.origin);
              if (attempt > 1) {
                url.searchParams.set("retry", String(attempt));
              }

              loadState =
                attempt > 1
                  ? "Retrying anatomy model load..."
                  : sourceIndex > 0
                    ? "Trying fallback anatomy model path..."
                    : "Loading anatomy model...";

              const gltf = await loader.loadAsync(url.toString());
              loadedRoot = gltf.scene;

              loadedRoot.traverse((child) => {
                if (!child.isMesh) return;

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

              if (!frameId) {
                animate();
              }

              return;
            } catch (error) {
              lastError = error;
              console.error("Failed to load anatomy model", error);

              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 600));
                continue;
              }
            }
          }
        }

        loadState = getModelLoadErrorMessage(lastError);
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

    <div class="viewer-info-panel" class:ready>
      <p class="viewer-info-copy">{selectedLabel}</p>
      <p class="credit">
        3D model based on "Myology" by Z-Anatomy, licensed CC-BY-SA 4.0.
      </p>
    </div>
  </div>
</div>

<style>
  .viewer-card {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .viewer-toolbar {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    display: flex;
    justify-content: center;
    width: max-content;
    max-width: calc(100% - 32px);
  }

  .toolbar-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .toolbar-actions button {
    border: none;
    border-radius: 999px;
    padding: 11px 16px;
    font: inherit;
    font-size: 0.86rem;
    cursor: pointer;
    background: var(--accent-strong, #520000);
    color: #fff5f5;
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
    background: var(--accent, #6e0505);
  }

  .toolbar-actions button.ghost {
    background: color-mix(in srgb, var(--surface, #faf8f7) 72%, transparent);
    color: var(--text, #241919);
    border: 1px solid
      color-mix(in srgb, var(--accent, #6e0505) 18%, var(--border, #cfc1c1));
  }

  .viewer-shell {
    position: relative;
    flex: 1;
    min-height: 0;
    height: 100%;
    overflow: visible;
  }

  .viewer-info-panel {
    position: absolute;
    left: 24px;
    right: auto;
    bottom: 20px;
    max-width: min(420px, calc(100% - 48px));
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--accent, #6e0505) 62%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--accent, #6e0505) 38%, var(--border, #cfc1c1));
    backdrop-filter: blur(14px);
    box-shadow: 0 14px 28px rgba(34, 14, 14, 0.16);
    color: #fff1f1;
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
    color: rgba(255, 232, 232, 0.82);
  }

  :global(.viewer-canvas) {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 40px 44px rgba(52, 18, 18, 0.2));
  }

  .viewer-status {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(320px, calc(100% - 48px));
    text-align: center;
    border-radius: 18px;
    background: linear-gradient(
      145deg,
      rgba(250, 246, 246, 0.96),
      rgba(231, 222, 222, 0.9)
    );
    color: var(--text, #241919);
    font-size: 0.96rem;
    letter-spacing: 0.02em;
    z-index: 3;
  }

  @media (max-width: 980px) {
    .viewer-shell {
      min-height: 0;
    }
  }

  @media (max-width: 700px) {
    .viewer-toolbar {
      top: 14px;
      max-width: calc(100% - 24px);
    }

    .toolbar-actions {
      width: 100%;
      gap: 8px;
    }

    .viewer-shell {
      min-height: 0;
    }

    .viewer-info-panel {
      left: 12px;
      bottom: 12px;
      max-width: calc(100% - 24px);
    }
  }
</style>
