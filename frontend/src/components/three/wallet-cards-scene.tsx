"use client";

import { useEffect, useMemo, useRef } from "react";
import { getLogoSvg } from "idn-finlogos/vanilla";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  CanvasTexture,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  type Group,
} from "three";
import { useDisposable } from "./materials";
import { IdleClock } from "./idle-clock";
import type { SceneActivity } from "./scene-host";

export type WalletCard = {
  id: string;
  name: string;
  /** Short balance, e.g. "Rp 18,3 jt". */
  balance: string;
  /** Last digits or category, printed small. */
  caption: string;
  initials: string;
  /** idn-finlogos slug; drawn in the chip instead of the initials once it loads. */
  logo?: string | null;
  color: string;
  ink: string;
};

const W = 1.7;
const H = 1.07;
const R = 0.12;
const DEPTH = 0.03;

function roundedRect(width: number, height: number, radius: number) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

const FACE_W = 680;
const FACE_H = 428;
const CHIP = { x: 40, y: 40, size: 84, pad: 12 };

/** Prints the card face (sheen, logo or initials chip, name, balance) onto a canvas. */
function paintFace(canvas: HTMLCanvasElement, card: WalletCard, logo?: HTMLImageElement) {
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const radius = (R / W) * canvas.width;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
  ctx.clip();
  ctx.fillStyle = card.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Soft sheen in the top-right corner, as on the 2D cards.
  const sheen = ctx.createRadialGradient(canvas.width * 0.95, 0, 0, canvas.width * 0.95, 0, canvas.width * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.28)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  // White chip holding the provider logo, or the initials until (or unless) it loads.
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.roundRect(CHIP.x, CHIP.y, CHIP.size, CHIP.size, 20);
  ctx.fill();
  if (logo && logo.naturalWidth > 0) {
    const box = CHIP.size - CHIP.pad * 2;
    const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
    const w = logo.naturalWidth * scale;
    const h = logo.naturalHeight * scale;
    ctx.drawImage(logo, CHIP.x + (CHIP.size - w) / 2, CHIP.y + (CHIP.size - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#1A1A1A";
    ctx.font = `700 34px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.initials, CHIP.x + CHIP.size / 2, CHIP.y + CHIP.size / 2 + 2);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = card.ink;
  ctx.font = `600 38px ${font}`;
  ctx.fillText(card.name.slice(0, 22), 146, 96);
  ctx.globalAlpha = 0.75;
  ctx.font = `500 28px ${font}`;
  ctx.fillText(card.caption, 40, 318);
  ctx.globalAlpha = 1;
  ctx.font = `700 54px ${font}`;
  ctx.fillText(card.balance, 40, 384);
  ctx.restore();
}

function faceTexture(card: WalletCard) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  paintFace(canvas, card);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Loads the provider logo as an image. The SVGs carry only a viewBox, so a pixel size is
 * added first; without it some browsers report a zero natural size and draw nothing.
 */
function loadLogo(slug: string, onLoad: (image: HTMLImageElement) => void) {
  const svg = getLogoSvg(slug);
  if (!svg) return () => {};
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  const ratio = box ? Number(box[1]) / Number(box[2]) : 1;
  const height = 256;
  const sized = svg.replace(
    "<svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(height * ratio)}" height="${height}"`,
  );
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  const image = new Image();
  let live = true;
  image.onload = () => {
    URL.revokeObjectURL(url);
    if (live) onLoad(image);
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
  return () => {
    live = false;
  };
}

/** Where each card rests in the fan. */
function fanSlot(index: number, count: number) {
  const offset = index - (count - 1) / 2;
  return { x: offset * 0.42, y: -Math.abs(offset) * 0.08, z: index * 0.06, tilt: -offset * 0.16 };
}

function Card({
  card,
  index,
  count,
  picked,
  onPick,
}: {
  card: WalletCard;
  index: number;
  count: number;
  picked: boolean;
  onPick: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const motion = useRef({ open: 0, lift: 0 });
  const assets = useDisposable(() => ({
    body: new ExtrudeGeometry(roundedRect(W, H, R), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    }),
    bodyMaterial: new MeshStandardMaterial({ color: card.color, roughness: 0.45, metalness: 0.08 }),
    face: new PlaneGeometry(W, H),
  }));
  const faceMaterial = useMemo(
    () => new MeshBasicMaterial({ map: faceTexture(card), transparent: true }),
    [card],
  );
  useEffect(
    () => () => {
      faceMaterial.map?.dispose();
      faceMaterial.dispose();
    },
    [faceMaterial],
  );
  // Repaint the face with the provider logo once its SVG has been rasterised.
  useEffect(() => {
    if (!card.logo) return;
    return loadLogo(card.logo, (image) => {
      const texture = faceMaterial.map as CanvasTexture | null;
      if (!texture) return;
      paintFace(texture.image as HTMLCanvasElement, card, image);
      texture.needsUpdate = true;
      invalidate();
    });
  }, [card, faceMaterial, invalidate]);

  useFrame(({ clock }, rawDelta) => {
    const node = group.current;
    if (!node) return;
    const delta = Math.min(rawDelta, 1 / 30);
    const state = motion.current;
    const place = fanSlot(index, count);
    const time = clock.elapsedTime;
    let moving = false;
    // Opening: every card starts on the pile and swings out to its fan slot, staggered.
    const target = time > index * 0.09 ? 1 : 0;
    if (Math.abs(target - state.open) > 0.001) {
      state.open += (target - state.open) * Math.min(1, delta * 5);
      moving = true;
    }
    const liftTarget = picked ? 1 : 0;
    if (Math.abs(liftTarget - state.lift) > 0.001) {
      state.lift += (liftTarget - state.lift) * Math.min(1, delta * 8);
      moving = true;
    }
    const open = state.open;
    const phase = index * 1.3;
    node.position.set(
      place.x * open,
      place.y * open + Math.sin(time * 1.2 + phase) * 0.035 + state.lift * 0.25,
      place.z + state.lift * 0.6,
    );
    node.rotation.set(
      -0.12 + Math.sin(time * 0.9 + phase) * 0.03,
      Math.sin(time * 0.7 + phase) * 0.06,
      place.tilt * open * (1 - state.lift),
    );
    if (moving) invalidate();
  });

  return (
    <group
      ref={group}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onPick(card.id);
      }}
    >
      <mesh geometry={assets.body} material={assets.bodyMaterial} position={[0, 0, -DEPTH]} />
      <mesh geometry={assets.face} material={faceMaterial} position={[0, 0, 0.0105]} />
    </group>
  );
}

/** Fan of wallet cards in provider colours. Tap a card to bring it forward. Lazy-loaded only. */
export default function WalletCardsScene({
  cards,
  picked,
  onPick,
  active,
}: { cards: WalletCard[]; picked: string | null; onPick: (id: string) => void } & SceneActivity) {
  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0.1, 4.3], fov: 30 }}
      style={{ touchAction: "pan-y", cursor: "pointer" }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 3, 5]} intensity={1.5} />
      {cards.map((card, index) => (
        <Card key={card.id} card={card} index={index} count={cards.length} picked={picked === card.id} onPick={onPick} />
      ))}
      <IdleClock active={active} />
    </Canvas>
  );
}
