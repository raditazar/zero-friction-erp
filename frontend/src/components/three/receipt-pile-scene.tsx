"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CylinderGeometry,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Shape,
  SphereGeometry,
  type Group,
  type Mesh,
} from "three";
import { PALETTE, useDisposable } from "./materials";
import { IdleClock } from "./idle-clock";
import type { SceneActivity } from "./scene-host";

const WIDTH = 1.15;
const HEIGHT = 1.6;
const TEETH = 7;
/** Receipts that sit on the pile at most; more pending items do not make it taller. */
export const MAX_RECEIPTS = 5;

/** A receipt outline: straight top, zig-zag tear along the bottom. */
function receiptShape() {
  const shape = new Shape();
  const half = WIDTH / 2;
  shape.moveTo(-half, HEIGHT / 2);
  shape.lineTo(half, HEIGHT / 2);
  shape.lineTo(half, -HEIGHT / 2);
  const step = WIDTH / TEETH;
  for (let i = 0; i < TEETH; i += 1) {
    const x = half - step * i;
    shape.lineTo(x - step / 2, -HEIGHT / 2 + 0.07);
    shape.lineTo(x - step, -HEIGHT / 2);
  }
  shape.lineTo(-half, HEIGHT / 2);
  return shape;
}

type Receipt = {
  key: number;
  /** Seconds left before it starts falling in. */
  delay: number;
  /** 0 = still above the frame, 1 = landed. */
  landed: number;
  /** 0 while on the pile; grows while flying off. */
  leave: number;
  /** +1 flies right (approved), -1 flies left (rejected). */
  dir: number;
};

function slot(index: number, count: number) {
  const offset = index - (count - 1) / 2;
  return { x: offset * 0.26, y: -0.05 + index * 0.02, z: index * 0.03, tilt: -offset * 0.13 };
}

function Pile({ count, lastDecision }: { count: number; lastDecision: number }) {
  const invalidate = useThree((state) => state.invalidate);
  const nextKey = useRef(0);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const live = useRef<Receipt[]>([]);
  const groups = useRef(new Map<number, Group>());
  const stamp = useRef<Group>(null);
  const mark = useRef<Mesh>(null);
  const stampState = useRef({ y: 3.2, velocity: 0, landed: false, markScale: 0 });

  const assets = useDisposable(() => ({
    paper: new ExtrudeGeometry(receiptShape(), { depth: 0.015, bevelEnabled: false }),
    paperMaterial: new MeshStandardMaterial({ color: "#FBF8F0", roughness: 0.9 }),
    line: new PlaneGeometry(1, 0.035),
    lineMaterial: new MeshBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.28 }),
    total: new PlaneGeometry(0.42, 0.07),
    totalMaterial: new MeshBasicMaterial({ color: PALETTE.mintDeep }),
    handle: new CylinderGeometry(0.11, 0.14, 0.7, 24),
    knob: new SphereGeometry(0.24, 24, 16),
    base: new CylinderGeometry(0.46, 0.46, 0.22, 40),
    pad: new CylinderGeometry(0.42, 0.42, 0.05, 40),
    woodMaterial: new MeshStandardMaterial({ color: PALETTE.ivoryShade, roughness: 0.6 }),
    baseMaterial: new MeshStandardMaterial({ color: PALETTE.mintDeep, roughness: 0.5 }),
    padMaterial: new MeshStandardMaterial({ color: PALETTE.mint, roughness: 0.4 }),
    ring: new RingGeometry(0.34, 0.46, 48),
    ringMaterial: new MeshBasicMaterial({ color: PALETTE.mint, transparent: true, opacity: 0.9 }),
  }));

  // Reconcile the pile with the pending count: new receipts fall in, removed ones fly off
  // in the direction of the last decision (right = approved, left = rejected).
  useEffect(() => {
    const target = Math.min(count, MAX_RECEIPTS);
    const resting = live.current.filter((receipt) => receipt.leave === 0);
    const next = [...live.current];
    if (target > resting.length) {
      for (let i = resting.length; i < target; i += 1) {
        next.push({ key: nextKey.current++, delay: (i - resting.length) * 0.12, landed: 0, leave: 0, dir: 1 });
      }
    } else if (target < resting.length) {
      resting.slice(target).forEach((receipt) => {
        receipt.leave = 0.0001;
        receipt.dir = lastDecision >= 0 ? 1 : -1;
      });
    }
    live.current = next;
    setReceipts([...next]);
    if (count === 0) stampState.current = { y: 3.2, velocity: 0, landed: false, markScale: 0 };
    invalidate();
  }, [count, lastDecision, invalidate]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const time = clock.elapsedTime;
    let moving = false;
    let finished = false;
    const resting = live.current.filter((receipt) => receipt.leave === 0);

    live.current.forEach((receipt) => {
      const group = groups.current.get(receipt.key);
      if (!group) return;
      const index = Math.max(0, resting.indexOf(receipt));
      const place = slot(index, Math.max(resting.length, 1));
      if (receipt.delay > 0) {
        receipt.delay -= delta;
        moving = true;
      } else if (receipt.landed < 1) {
        receipt.landed = Math.min(1, receipt.landed + delta * 1.8);
        moving = true;
      }
      // Ease-out fall from above the frame with a little sway on the way down.
      const fall = 1 - Math.pow(1 - receipt.landed, 3);
      const phase = receipt.key * 1.7;
      group.visible = receipt.delay <= 0;
      group.position.set(place.x, place.y + (1 - fall) * 3.4, place.z);
      group.rotation.set(
        Math.sin(time * 1.1 + phase) * 0.06,
        Math.sin(time * 0.8 + phase) * 0.1,
        place.tilt + (1 - fall) * Math.sin(phase) * 0.8 + Math.sin(time * 1.4 + phase) * 0.035,
      );
      if (receipt.leave > 0) {
        receipt.leave += delta * 2.2;
        group.position.x += receipt.dir * receipt.leave * receipt.leave * 4;
        group.position.y += receipt.leave * 0.6;
        group.rotation.z -= receipt.dir * receipt.leave * 1.2;
        moving = true;
        if (receipt.leave > 1.4) finished = true;
      }
    });

    if (finished) {
      live.current = live.current.filter((receipt) => receipt.leave <= 1.4);
      setReceipts([...live.current]);
    }

    // Empty queue: the stamp drops, hits once, lifts a little and leaves a mint ring behind.
    if (stamp.current && mark.current) {
      const state = stampState.current;
      const empty = count === 0 && live.current.length === 0;
      stamp.current.visible = empty;
      mark.current.visible = empty && state.markScale > 0;
      if (empty) {
        if (!state.landed) {
          state.velocity -= 22 * delta;
          state.y += state.velocity * delta;
          if (state.y <= 0) {
            state.y = 0;
            state.velocity = Math.abs(state.velocity) * 0.18;
            state.landed = true;
          }
          moving = true;
        } else {
          state.markScale = Math.min(1, state.markScale + delta * 4);
          // Settle a little above the mark, then sway while idle.
          state.y += (0.6 - state.y) * Math.min(1, delta * 3);
        }
        // Offset so the pad's face meets the mark (y = -0.05) when state.y reaches 0.
        stamp.current.position.y = state.y + 0.145;
        stamp.current.rotation.z = state.landed ? Math.sin(time * 1.2) * 0.07 : 0;
        mark.current.scale.setScalar(0.6 + state.markScale * 0.4);
      }
    }

    if (moving) invalidate();
  });

  return (
    <>
      {receipts.map((receipt) => (
        <group
          key={receipt.key}
          ref={(node) => {
            if (node) groups.current.set(receipt.key, node);
            else groups.current.delete(receipt.key);
          }}
          visible={false}
        >
          <mesh geometry={assets.paper} material={assets.paperMaterial} />
          {[0.5, 0.32, 0.14, -0.04].map((y, line) => (
            <mesh
              key={y}
              geometry={assets.line}
              material={assets.lineMaterial}
              position={[line === 3 ? -0.12 : 0, y, 0.017]}
              scale={[line === 3 ? 0.55 : 0.8, 1, 1]}
            />
          ))}
          <mesh geometry={assets.total} material={assets.totalMaterial} position={[0.17, -0.34, 0.017]} />
        </group>
      ))}
      <mesh ref={mark} geometry={assets.ring} material={assets.ringMaterial} position={[0, -0.05, -0.2]} visible={false} />
      <group ref={stamp} visible={false} rotation={[0.35, 0, 0]} scale={0.75}>
        <mesh geometry={assets.knob} material={assets.woodMaterial} position={[0, 0.72, 0]} />
        <mesh geometry={assets.handle} material={assets.woodMaterial} position={[0, 0.36, 0]} />
        <mesh geometry={assets.base} material={assets.baseMaterial} position={[0, -0.1, 0]} />
        <mesh geometry={assets.pad} material={assets.padMaterial} position={[0, -0.235, 0]} />
      </group>
    </>
  );
}

/** Receipts waiting in the inbox; turns into a stamp when the queue is empty. Lazy-loaded only. */
export default function ReceiptPileScene({
  count,
  lastDecision,
  active,
}: { count: number; lastDecision: number } & SceneActivity) {
  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0.2, 6], fov: 30 }}
      style={{ touchAction: "pan-y" }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <Pile count={count} lastDecision={lastDecision} />
      <IdleClock active={active} />
    </Canvas>
  );
}
