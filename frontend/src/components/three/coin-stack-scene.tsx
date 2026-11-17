"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CircleGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, type Group } from "three";

const THICKNESS = 0.2;
const RADIUS = 1;
const IVORY = "#F4EEE0";
const IVORY_SHADE = "#D9CFBA";
const MINT = "#19E6C1";
const GRAVITY = 26;

type CoinState = { y: number; velocity: number; delay: number; settled: boolean; tilt: number };

/** Deterministic per-coin jitter so the pile looks hand-stacked and is identical on every mount. */
function jitter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function Stack({ count, drop }: { count: number; drop: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const pile = useRef<Group>(null);
  const coins = useRef<(Group | null)[]>([]);
  const physics = useRef<CoinState[]>([]);
  const spin = useRef({ angle: -0.5, velocity: 0, dragging: false, lastX: 0 });

  // One geometry/material set shared by every coin: ivory faces, mint edge.
  const assets = useMemo(() => {
    const ivory = new MeshStandardMaterial({ color: IVORY, roughness: 0.55, metalness: 0.05 });
    return {
      body: new CylinderGeometry(RADIUS, RADIUS, THICKNESS, 48),
      bodyMaterials: [new MeshStandardMaterial({ color: MINT, roughness: 0.35, metalness: 0.1 }), ivory, ivory],
      ring: new TorusGeometry(RADIUS * 0.66, 0.022, 8, 48),
      ringMaterial: new MeshStandardMaterial({ color: IVORY_SHADE, roughness: 0.7 }),
      shadow: new CircleGeometry(RADIUS * 1.25, 40),
      shadowMaterial: new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.12 }),
    };
  }, []);

  useEffect(
    () => () => {
      assets.body.dispose();
      assets.ring.dispose();
      assets.shadow.dispose();
      assets.bodyMaterials.forEach((material) => material.dispose());
      assets.ringMaterial.dispose();
      assets.shadowMaterial.dispose();
    },
    [assets],
  );

  // (Re)start the drop whenever the stack height changes or the data arrives.
  useEffect(() => {
    physics.current = Array.from({ length: count }, (_, index) => ({
      y: drop ? index * THICKNESS + 3.2 + index * 0.25 : index * THICKNESS,
      velocity: 0,
      delay: drop ? index * 0.085 : 0,
      settled: !drop,
      tilt: drop ? jitter(index, 3) * 0.5 : 0,
    }));
    invalidate();
  }, [count, drop, invalidate]);

  // Drag horizontally to turn the pile; vertical swipes still scroll the page (touch-action: pan-y).
  useEffect(() => {
    const element = gl.domElement;
    const state = spin.current;
    const down = (event: PointerEvent) => {
      state.dragging = true;
      state.lastX = event.clientX;
      state.velocity = 0;
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!state.dragging) return;
      const delta = (event.clientX - state.lastX) * 0.012;
      state.lastX = event.clientX;
      state.angle += delta;
      state.velocity = delta * 60;
      invalidate();
    };
    const up = () => {
      state.dragging = false;
      invalidate();
    };
    // A tab coming back to the foreground repaints once; the loop stays idle otherwise.
    const visible = () => {
      if (!document.hidden) invalidate();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    document.addEventListener("visibilitychange", visible);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [gl, invalidate]);

  useFrame((_, rawDelta) => {
    if (document.hidden) return;
    const delta = Math.min(rawDelta, 1 / 30);
    let active = false;

    physics.current.forEach((coin, index) => {
      const mesh = coins.current[index];
      if (!mesh) return;
      const rest = index * THICKNESS;
      if (!coin.settled) {
        active = true;
        if (coin.delay > 0) {
          coin.delay -= delta;
        } else {
          coin.velocity -= GRAVITY * delta;
          coin.y += coin.velocity * delta;
          if (coin.y <= rest) {
            coin.y = rest;
            // One soft bounce, then rest.
            coin.velocity = Math.abs(coin.velocity) > 2.2 ? -coin.velocity * 0.22 : 0;
            if (coin.velocity === 0) coin.settled = true;
          }
          coin.tilt *= 0.86;
        }
      }
      mesh.position.y = coin.y + THICKNESS / 2;
      mesh.rotation.z = coin.settled ? 0 : coin.tilt;
      mesh.visible = coin.delay <= 0 || coin.settled;
    });

    const state = spin.current;
    if (!state.dragging && Math.abs(state.velocity) > 0.02) {
      state.angle += state.velocity * delta;
      state.velocity *= 0.92;
      active = true;
    }
    if (pile.current) pile.current.rotation.y = state.angle;

    // frameloop="demand": only ask for another frame while something is still moving.
    if (active) invalidate();
  });

  return (
    <group ref={pile} position={[0, -(count * THICKNESS) / 2 - 0.25, 0]}>
      <mesh geometry={assets.shadow} material={assets.shadowMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} />
      {Array.from({ length: count }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            coins.current[index] = node;
          }}
          position={[jitter(index, 1) * 0.07, index * THICKNESS + THICKNESS / 2, jitter(index, 2) * 0.07]}
          rotation={[0, jitter(index, 4) * Math.PI, 0]}
        >
          <mesh geometry={assets.body} material={assets.bodyMaterials} />
          {index === count - 1 ? (
            <mesh geometry={assets.ring} material={assets.ringMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, THICKNESS / 2, 0]} />
          ) : null}
        </group>
      ))}
    </group>
  );
}

/** Procedural ivory coins with a mint edge. Loaded lazily; never import this file statically. */
export default function CoinStackScene({ count, drop }: { count: number; drop: boolean }) {
  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 3.4, 9.6], fov: 26 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
      style={{ touchAction: "pan-y", cursor: "grab" }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={1.9} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Stack count={count} drop={drop} />
    </Canvas>
  );
}
