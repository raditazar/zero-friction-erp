"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Mesh,
} from "three";
import { PALETTE, useDisposable } from "./materials";
import { IdleClock } from "./idle-clock";
import type { SceneActivity } from "./scene-host";

const BOTTOM = -0.95;
const TOP = 0.78;
const INNER = 0.66;
const BUBBLES = 7;

export type JarTone = "mint" | "caution" | "negative";
const TONE_COLOR: Record<JarTone, string> = {
  mint: PALETTE.mint,
  caution: PALETTE.caution,
  negative: PALETTE.negative,
};

/** Jar outline (radius, height) turned on a lathe: flat base, round shoulders, short neck and lip. */
function jarProfile() {
  return [
    [0, -1],
    [0.62, -1],
    [0.72, -0.94],
    [0.75, -0.8],
    [0.76, 0.55],
    [0.7, 0.8],
    [0.56, 0.95],
    [0.56, 1.05],
    [0.62, 1.08],
  ].map(([x, y]) => new Vector2(x, y));
}

function Jar({ level, tone }: { level: number; tone: JarTone }) {
  const invalidate = useThree((state) => state.invalidate);
  const body = useRef<Mesh>(null);
  const surface = useRef<Mesh>(null);
  const bubbles = useRef<(Mesh | null)[]>([]);
  // shown: what is drawn now; target: where it is heading; draining: refill after a period change.
  const fill = useRef({ shown: 0, target: level, draining: false, first: true });
  const liquidColor = useRef(new Color(TONE_COLOR[tone]));

  const assets = useDisposable(() => {
    const surfaceGeometry = new RingGeometry(0.0001, INNER, 48, 6);
    surfaceGeometry.rotateX(-Math.PI / 2);
    return {
      glass: new LatheGeometry(jarProfile(), 56),
      glassMaterial: new MeshStandardMaterial({
        color: "#FFFFFF",
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
        metalness: 0.1,
        side: DoubleSide,
        depthWrite: false,
      }),
      rim: new TorusGeometry(0.6, 0.035, 10, 56),
      rimMaterial: new MeshStandardMaterial({ color: PALETTE.ivory, roughness: 0.3 }),
      // Unit-height column scaled to the fill level each frame.
      liquid: new CylinderGeometry(INNER, INNER * 0.96, 1, 48, 1, true),
      liquidMaterial: new MeshStandardMaterial({ color: TONE_COLOR[tone], transparent: true, opacity: 0.82, roughness: 0.35, side: DoubleSide }),
      surface: surfaceGeometry,
      surfaceBase: Float32Array.from(surfaceGeometry.attributes.position.array as Float32Array),
      bubble: new SphereGeometry(0.035, 10, 8),
      bubbleMaterial: new MeshStandardMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.6 }),
    };
  });

  // A new month (or a new budget) drains the jar and refills it to the new level.
  useEffect(() => {
    const state = fill.current;
    if (state.first) {
      state.first = false;
      state.target = level;
    } else if (Math.abs(level - state.target) > 0.001) {
      state.target = level;
      state.draining = true;
    }
    invalidate();
  }, [level, invalidate]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const time = clock.elapsedTime;
    const state = fill.current;
    let moving = false;

    const goal = state.draining ? 0 : state.target;
    if (Math.abs(goal - state.shown) > 0.002) {
      state.shown += (goal - state.shown) * Math.min(1, delta * (state.draining ? 4 : 2.2));
      moving = true;
    } else if (state.draining) {
      state.draining = false;
      moving = true;
    }

    // Colour eases toward the tone (mint, then caution or negative as the budget runs out).
    const material = body.current?.material as MeshStandardMaterial | undefined;
    if (material) {
      const before = material.color.getHex();
      liquidColor.current.set(TONE_COLOR[tone]);
      material.color.lerp(liquidColor.current, Math.min(1, delta * 3));
      if (material.color.getHex() !== before) moving = true;
    }

    const height = Math.max(0.0001, state.shown * (TOP - BOTTOM));
    const surfaceY = BOTTOM + height;
    if (body.current) {
      body.current.scale.y = height;
      body.current.position.y = BOTTOM + height / 2;
      body.current.visible = state.shown > 0.005;
    }
    if (surface.current) {
      surface.current.visible = state.shown > 0.005;
      surface.current.position.y = surfaceY;
      (surface.current.material as MeshStandardMaterial).color.copy(material?.color ?? liquidColor.current);
      // Gentle ripples: two travelling sine waves over the concentric surface rings.
      const position = surface.current.geometry.attributes.position as BufferAttribute;
      const base = assets.surfaceBase;
      for (let i = 0; i < position.count; i += 1) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        const wave = Math.sin(x * 6 + time * 2.2) * 0.012 + Math.sin(z * 5 - time * 1.7) * 0.01;
        position.setY(i, wave * Math.min(1, Math.hypot(x, z) / INNER + 0.3));
      }
      position.needsUpdate = true;
    }

    // Bubbles rise through the liquid and pop at the surface, each on its own clock.
    bubbles.current.forEach((bubble, index) => {
      if (!bubble) return;
      bubble.visible = state.shown > 0.12;
      const cycle = ((time * 0.35 + index / BUBBLES) % 1 + 1) % 1;
      const angle = index * 2.4;
      const radius = 0.15 + (index % 3) * 0.14;
      bubble.position.set(
        Math.cos(angle) * radius + Math.sin(time * 2 + index) * 0.02,
        BOTTOM + 0.05 + cycle * Math.max(0, height - 0.1),
        Math.sin(angle) * radius,
      );
      bubble.scale.setScalar(0.6 + cycle * 0.8);
    });

    if (moving) invalidate();
  });

  return (
    <group rotation={[0.18, 0, 0]}>
      <mesh ref={body} geometry={assets.liquid} material={assets.liquidMaterial} renderOrder={1} />
      <mesh ref={surface} geometry={assets.surface} renderOrder={1}>
        <meshStandardMaterial color={TONE_COLOR[tone]} transparent opacity={0.9} roughness={0.25} side={DoubleSide} />
      </mesh>
      {Array.from({ length: BUBBLES }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            bubbles.current[index] = node;
          }}
          geometry={assets.bubble}
          material={assets.bubbleMaterial}
          renderOrder={2}
        />
      ))}
      <mesh geometry={assets.glass} material={assets.glassMaterial} renderOrder={3} />
      <mesh geometry={assets.rim} material={assets.rimMaterial} position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/** Glass jar whose liquid shows how much of this month's budget is left. Lazy-loaded only. */
export default function BudgetJarScene({ level, tone, active }: { level: number; tone: JarTone } & SceneActivity) {
  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0.45, 4.4], fov: 32 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.05, 0)}
      style={{ touchAction: "pan-y" }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.8} />
      <directionalLight position={[-3, 1, -2]} intensity={0.6} />
      <Jar level={level} tone={tone} />
      <IdleClock active={active} />
    </Canvas>
  );
}
