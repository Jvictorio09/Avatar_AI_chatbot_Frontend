// src/components/Avatar.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useChat } from "../hooks/useChat";

const clamp = THREE.MathUtils.clamp;
const lerp  = THREE.MathUtils.lerp;
const deg   = THREE.MathUtils.degToRad;

// ----- stance knobs (change here) -------------------------------------------
const USE_Y_FOR_ADDUCTION = true; // <- try true for Mixamo/Wolf rigs; false for Z rigs
const ARM_IN_DEG          = 10;   // bring upper arms toward body (adduction)
const ARM_FWD_DEG         = 7;    // slight forward pitch on upper arms
const ELBOW_BASE_DEG      = 10;   // small default elbow bend
const SHOULDER_IN_DEG     = 4;    // tiny inward shoulder roll
const SHOULDER_FWD_DEG    = 3;    // tiny forward shoulder pitch

// ----- lipsync tuning --------------------------------------------------------
const VISEME_INTENSITY = 1.25;
const VISEME_LERP      = 0.28;
const JAW_GAIN         = 1.35;
const JAW_MIN          = 0.02;
const WORD_CLOSURE     = 0.07;

const facialExpressions = {
  default: {},
  smile: { browInnerUp: 0.17, eyeSquintLeft: 0.4, eyeSquintRight: 0.44, noseSneerLeft: 0.17, noseSneerRight: 0.14, mouthPressLeft: 0.61, mouthPressRight: 0.41 },
  funnyFace: { jawLeft: 0.63, mouthPucker: 0.53, noseSneerLeft: 1, noseSneerRight: 0.39, mouthLeft: 1, eyeLookUpLeft: 1, eyeLookUpRight: 1, cheekPuff: 1, mouthDimpleLeft: 0.4147, mouthRollLower: 0.32, mouthSmileLeft: 0.355, mouthSmileRight: 0.355 },
  sad: { mouthFrownLeft: 1, mouthFrownRight: 1, mouthShrugLower: 0.78341, browInnerUp: 0.452, eyeSquintLeft: 0.72, eyeSquintRight: 0.75, eyeLookDownLeft: 0.5, eyeLookDownRight: 0.5, jawForward: 1 },
  surprised: { eyeWideLeft: 0.5, eyeWideRight: 0.5, jawOpen: 0.351, mouthFunnel: 1, browInnerUp: 1 },
  angry: { browDownLeft: 1, browDownRight: 1, eyeSquintLeft: 1, eyeSquintRight: 1, jawForward: 1, jawLeft: 1, mouthShrugLower: 1, noseSneerLeft: 1, noseSneerRight: 0.42, eyeLookDownLeft: 0.16, eyeLookDownRight: 0.16, cheekSquintLeft: 1, cheekSquintRight: 1, mouthClose: 0.23, mouthFunnel: 0.63, mouthDimpleRight: 1 },
};

const corresponding = { A:"viseme_PP", B:"viseme_kk", C:"viseme_I", D:"viseme_AA", E:"viseme_O", F:"viseme_U", G:"viseme_FF", H:"viseme_TH", X:"viseme_PP" };

let setupMode = false;

export function Avatar(props) {
  const { nodes, materials, scene, animations: glbClips } = useGLTF("/models/68dd0d74c0cc7f0f2779fce7.glb");
  const { message, onMessagePlayed } = useChat();

  // ----- audio / lipsync -----------------------------------------------------
  const [lipsync, setLipsync] = useState();
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);
  const [audio, setAudio] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ----- play any GLB animation (Idle etc.) ----------------------------------
  const group = useRef();
  const { actions } = useAnimations(glbClips || [], group);
  const defaultAnim = glbClips?.find(a => a.name === "Idle") ? "Idle" : glbClips?.[0]?.name ?? "None";
  const [animation, setAnimation] = useState(defaultAnim);
  useEffect(() => {
    if (!actions || animation === "None") return;
    Object.values(actions).forEach(a => a?.stop());
    const act = actions[animation];
    act?.reset().fadeIn(0.3).play();
    return () => act?.fadeOut(0.2);
  }, [animation, actions]);

  // ----- bone map from skeleton (not scene graph) ----------------------------
  const boneIndex = useRef({});
  useEffect(() => {
    const idx = {};
    const add = (skinned) => {
      if (!skinned?.skeleton?.bones) return;
      for (const b of skinned.skeleton.bones) if (b?.name && !idx[b.name]) idx[b.name] = b;
    };
    add(nodes.Wolf3D_Body);
    add(nodes.Wolf3D_Head);
    add(nodes.Wolf3D_Teeth);
    add(nodes.Wolf3D_Hair);
    add(nodes.Wolf3D_Outfit_Bottom);
    add(nodes.Wolf3D_Outfit_Footwear);
    add(nodes.Wolf3D_Outfit_Top);
    add(nodes.EyeLeft);
    add(nodes.EyeRight);
    boneIndex.current = idx;
  }, [nodes]);

  const getBone = (...aliases) => {
    const idx = boneIndex.current;
    for (const a of aliases) if (idx[a]) return idx[a];
    return null;
  };

  // ----- bone refs ------------------------------------------------------------
  const leftShoulder  = useRef(null);
  const rightShoulder = useRef(null);
  const leftArm       = useRef(null);
  const rightArm      = useRef(null);
  const leftForeArm   = useRef(null);
  const rightForeArm  = useRef(null);
  const leftHand      = useRef(null);
  const rightHand     = useRef(null);
  const spine         = useRef(null);
  const chest         = useRef(null);
  const neck          = useRef(null);
  const head          = useRef(null);

  // ----- capture base pose ----------------------------------------------------
  const initialBase = useRef(null);
  const base        = useRef(null);
  const capturePose = () => ({
    groupZ: group.current?.rotation.z ?? 0,
    hipsY: nodes.Hips?.position.y ?? 0,
    leftShoulder: leftShoulder.current?.rotation.clone(),
    rightShoulder: rightShoulder.current?.rotation.clone(),
    leftArm: leftArm.current?.rotation.clone(),
    rightArm: rightArm.current?.rotation.clone(),
    leftForeArm: leftForeArm.current?.rotation.clone(),
    rightForeArm: rightForeArm.current?.rotation.clone(),
    leftHand: leftHand.current?.rotation.clone(),
    rightHand: rightHand.current?.rotation.clone(),
    spine: spine.current?.rotation.clone(),
    chest: chest.current?.rotation.clone(),
    neck: neck.current?.rotation.clone(),
    head: head.current?.rotation.clone(),
  });

  // one-time bone binding + relaxed base pose
  useEffect(() => {
    leftShoulder.current  = getBone("LeftShoulder","mixamorigLeftShoulder","shoulder_L","UpperArmRoot_L");
    rightShoulder.current = getBone("RightShoulder","mixamorigRightShoulder","shoulder_R","UpperArmRoot_R");
    leftArm.current       = getBone("LeftArm","mixamorigLeftArm","upper_arm.L","UpperArm_L","LeftUpperArm");
    rightArm.current      = getBone("RightArm","mixamorigRightArm","upper_arm.R","UpperArm_R","RightUpperArm");
    leftForeArm.current   = getBone("LeftForeArm","mixamorigLeftForeArm","lower_arm.L","ForeArm_L","LeftLowerArm");
    rightForeArm.current  = getBone("RightForeArm","mixamorigRightForeArm","lower_arm.R","ForeArm_R","RightLowerArm");
    leftHand.current      = getBone("LeftHand","mixamorigLeftHand","hand.L","Hand_L");
    rightHand.current     = getBone("RightHand","mixamorigRightHand","hand.R","Hand_R");
    spine.current         = getBone("Spine","spine","mixamorigSpine");
    chest.current         = getBone("Spine1","Spine2","chest","mixamorigSpine1","mixamorigSpine2");
    neck.current          = getBone("Neck","mixamorigNeck");
    head.current          = getBone("Head","mixamorigHead");

    initialBase.current = capturePose();
    base.current        = capturePose();

    // >>> Apply a static relaxed pose ONCE so it sticks even with Idle clips
    applyStaticRelaxedPose();
    // recapture as the new base for all additive motion
    base.current = capturePose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  function applyStaticRelaxedPose() {
    if (!base.current) return;
    const b = base.current;

    // shoulders: slight forward + tiny inward
    leftShoulder.current.rotation.x  = b.leftShoulder.x  + deg(SHOULDER_FWD_DEG);
    rightShoulder.current.rotation.x = b.rightShoulder.x + deg(SHOULDER_FWD_DEG);
    leftShoulder.current.rotation.z  = b.leftShoulder.z  - deg(SHOULDER_IN_DEG);
    rightShoulder.current.rotation.z = b.rightShoulder.z + deg(SHOULDER_IN_DEG);

    // upper arms: bring inward (choose axis) + small forward
    if (USE_Y_FOR_ADDUCTION) {
      leftArm.current.rotation.y  = b.leftArm.y  - deg(ARM_IN_DEG);
      rightArm.current.rotation.y = b.rightArm.y + deg(ARM_IN_DEG);
    } else {
      leftArm.current.rotation.z  = b.leftArm.z  - deg(ARM_IN_DEG);
      rightArm.current.rotation.z = b.rightArm.z + deg(ARM_IN_DEG);
    }
    leftArm.current.rotation.x  = b.leftArm.x  + deg(ARM_FWD_DEG);
    rightArm.current.rotation.x = b.rightArm.x + deg(ARM_FWD_DEG);

    // elbows: small bend
    leftForeArm.current.rotation.x  = b.leftForeArm.x  + deg(ELBOW_BASE_DEG);
    rightForeArm.current.rotation.x = b.rightForeArm.x + deg(ELBOW_BASE_DEG);
  }

  // ----- message -> audio/analyser -------------------------------------------
  useEffect(() => {
    if (!message) {
      setAnimation(defaultAnim);
      setIsSpeaking(false);
      return;
    }
    setAnimation(message.animation || "Idle");
    setFacialExpression(message.facialExpression || "default");
    setLipsync(message.lipsync);

    const el = new Audio("data:audio/mp3;base64," + message.audio);
    el.crossOrigin = "anonymous";
    el.play();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const buf = new Uint8Array(analyser.fftSize);
    src.connect(analyser); analyser.connect(ctx.destination);

    analyserRef.current = analyser;
    dataRef.current     = buf;

    setAudio(el);
    setIsSpeaking(true);

    el.onended = () => {
      setIsSpeaking(false);
      setAnimation(defaultAnim);
      onMessagePlayed();
    };
  }, [message, onMessagePlayed]);

  // ----- helpers --------------------------------------------------------------
  function rmsFromAnalyser(analyser, buf) {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  const lerpMorphTarget = (target, value, speed = 0.1) => {
    scene.traverse((child) => {
      if (!child.isSkinnedMesh || !child.morphTargetDictionary) return;
      const index = child.morphTargetDictionary[target];
      if (index === undefined) return;
      const arr = child.morphTargetInfluences;
      if (!arr || arr[index] === undefined) return;
      arr[index] = THREE.MathUtils.lerp(arr[index], value, speed);
    });
  };

  // ----- blink / expression ---------------------------------------------------
  const [blink, setBlink] = useState(false);
  const [winkLeft, setWinkLeft] = useState(false);
  const [winkRight, setWinkRight] = useState(false);
  const [facialExpression, setFacialExpression] = useState("");

  useEffect(() => {
    let blinkTimeout;
    const next = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); next(); }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };
    next();
    return () => clearTimeout(blinkTimeout);
  }, []);

  const toBaseX = (bone, baseEuler, add, s=0.12) => { if (bone && baseEuler) bone.rotation.x = lerp(bone.rotation.x, baseEuler.x + add, s); };
  const toBaseY = (bone, baseEuler, add, s=0.12) => { if (bone && baseEuler) bone.rotation.y = lerp(bone.rotation.y, baseEuler.y + add, s); };
  const toBaseZ = (bone, baseEuler, add, s=0.12) => { if (bone && baseEuler) bone.rotation.z = lerp(bone.rotation.z, baseEuler.z + add, s); };

  // ----- per-frame (idle + gestures + lipsync) --------------------------------
  const blinkPulse = useRef(0);
  useEffect(() => { if (blink) blinkPulse.current = 1; }, [blink]);

  useFrame(() => {
    if (!base.current) return;

    // expression morphs
    if (nodes.EyeLeft?.morphTargetDictionary) {
      Object.keys(nodes.EyeLeft.morphTargetDictionary).forEach((key) => {
        if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
        const mapping = facialExpressions[facialExpression];
        lerpMorphTarget(key, mapping?.[key] ?? 0, 0.1);
      });
    }

    // energy
    const energyNow = (() => {
      if (!analyserRef.current || !dataRef.current || !isSpeaking) return 0;
      const e = rmsFromAnalyser(analyserRef.current, dataRef.current);
      return clamp(Math.pow(e * 1.8, 1.3), 0, 1);
    })();

    // ===== idle (relative to our new base) =====
    const t = performance.now() * 0.001;
    const k = isSpeaking ? 0.35 : 1.0;

    const breathe   = Math.sin(t * 1.1) * 0.012 * k;
    const headYaw   = Math.sin(t * 0.8) * 0.018 * k;
    const headPitch = Math.sin(t * 1.3) * 0.018 * 0.6 * k;
    const sway      = Math.sin(t * 0.6) * 0.008 * k;
    const idleL     = Math.sin(t * 1.7) * 0.04 * (isSpeaking ? 0.3 : 1) * k;
    const idleR     = Math.sin(t * 1.9 + 0.8) * 0.04 * (isSpeaking ? 0.3 : 1) * k;

    if (nodes.Hips) nodes.Hips.position.y = base.current.hipsY + Math.sin(t * 1.2) * 0.01;

    toBaseX(chest.current, base.current.chest, breathe, 0.12);
    toBaseX(spine.current, base.current.spine, breathe * 0.6, 0.12);

    if (head.current && base.current.head) {
      head.current.rotation.y = lerp(head.current.rotation.y, base.current.head.y + headYaw, 0.12);
      head.current.rotation.x = lerp(head.current.rotation.x, base.current.head.x + headPitch, 0.12);
    }
    if (group.current) group.current.rotation.z = lerp(group.current.rotation.z, base.current.groupZ + sway, 0.10);

    toBaseY(leftHand.current,  base.current.leftHand,  idleL, 0.10);
    toBaseY(rightHand.current, base.current.rightHand, -idleR, 0.10);

    // soft shoulder/elbow micro motion (no big swings)
    const dtPulse = 0.14;
    blinkPulse.current = Math.max(0, blinkPulse.current - dtPulse);
    const pulseShoulder = deg(2.0) * blinkPulse.current;
    const pulseElbow    = deg(3.0) * blinkPulse.current;

    toBaseZ(leftShoulder.current,  base.current.leftShoulder,  +breathe * 0.45 + sway * 0.4 + pulseShoulder, 0.12);
    toBaseZ(rightShoulder.current, base.current.rightShoulder, -breathe * 0.45 - sway * 0.4 - pulseShoulder, 0.12);
    toBaseX(leftShoulder.current,  base.current.leftShoulder,  deg(SHOULDER_FWD_DEG), 0.12);
    toBaseX(rightShoulder.current, base.current.rightShoulder, deg(SHOULDER_FWD_DEG), 0.12);

    toBaseX(leftForeArm.current,  base.current.leftForeArm,  deg(ELBOW_BASE_DEG) + pulseElbow, 0.14);
    toBaseX(rightForeArm.current, base.current.rightForeArm, deg(ELBOW_BASE_DEG) + pulseElbow, 0.14);

    // ===== speaking gestures (kept) =====
    const speakingAmp = isSpeaking ? (0.18 + energyNow * 0.35) : 0;
    const ta = audio?.currentTime || 0;

    const L = { z: Math.sin(ta * 2.2) * speakingAmp,                  y: Math.sin(ta * 1.6 + 0.6) * speakingAmp };
    const R = { z: Math.sin(ta * 2.0 + Math.PI * 0.35) * speakingAmp, y: Math.sin(ta * 1.7 + 1.1) * speakingAmp };

    const damp = 0.18;
    toBaseZ(leftForeArm.current,  base.current.leftForeArm,  L.z, damp);
    toBaseZ(rightForeArm.current, base.current.rightForeArm, -R.z, damp);
    toBaseY(leftHand.current,  base.current.leftHand,  L.y,  damp);
    toBaseY(rightHand.current, base.current.rightHand, -R.y, damp);

    toBaseX(leftArm.current,  base.current.leftArm,  0.04 * speakingAmp, 0.12);
    toBaseX(rightArm.current, base.current.rightArm, 0.03 * speakingAmp, 0.12);

    // clamps
    const clampAxis = (bone, axis, min, max) => { if (bone) bone.rotation[axis] = clamp(bone.rotation[axis], min, max); };
    clampAxis(leftForeArm.current,  "x", deg(-5), deg(80));
    clampAxis(rightForeArm.current, "x", deg(-5), deg(80));

    // blinks
    const blinkDampen = clamp(1 - energyNow * 0.8, 0.15, 1);
    lerpMorphTarget("eyeBlinkLeft",  (blink || winkLeft  ? 1 : 0) * blinkDampen, 0.5);
    lerpMorphTarget("eyeBlinkRight", (blink || winkRight ? 1 : 0) * blinkDampen, 0.5);

    if (setupMode) return;

    // visemes
    const applied = [];
    let wantClosure = false;
    if (lipsync && audio && isSpeaking) {
      const tcur = audio.currentTime;
      for (let i = 0; i < lipsync.mouthCues.length; i++) {
        const cue = lipsync.mouthCues[i];
        if (tcur >= cue.start && tcur <= cue.end) {
          const mt = corresponding[cue.value] || "viseme_PP";
          applied.push(mt);
          lerpMorphTarget(mt, clamp(VISEME_INTENSITY, 0, 1), VISEME_LERP);
          if (cue.end - tcur < 0.045) wantClosure = true;
          break;
        }
      }
    }
    if (wantClosure) lerpMorphTarget("viseme_PP", WORD_CLOSURE, 0.5);
    Object.values(corresponding).forEach((mt) => { if (!applied.includes(mt)) lerpMorphTarget(mt, 0, 0.22); });

    // jaw
    const wobble = isSpeaking ? Math.sin((audio?.currentTime || 0) * 18) * 0.03 : 0;
    const targetJaw = isSpeaking ? clamp(JAW_MIN + energyNow * JAW_GAIN + wobble, 0, 1) : 0;
    lerpMorphTarget("jawOpen", targetJaw, 0.25);
  });

  // ----- render ---------------------------------------------------------------
  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.1, 0]}>
      <primitive object={nodes.Hips} />
      <skinnedMesh name="Wolf3D_Body"           geometry={nodes.Wolf3D_Body.geometry}           material={materials.Wolf3D_Body}           skeleton={nodes.Wolf3D_Body.skeleton} />
      <skinnedMesh name="Wolf3D_Outfit_Bottom"  geometry={nodes.Wolf3D_Outfit_Bottom.geometry}  material={materials.Wolf3D_Outfit_Bottom}  skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />
      <skinnedMesh name="Wolf3D_Outfit_Footwear"geometry={nodes.Wolf3D_Outfit_Footwear.geometry}material={materials.Wolf3D_Outfit_Footwear}skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />
      <skinnedMesh name="Wolf3D_Outfit_Top"     geometry={nodes.Wolf3D_Outfit_Top.geometry}     material={materials.Wolf3D_Outfit_Top}     skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
      <skinnedMesh name="Wolf3D_Hair"           geometry={nodes.Wolf3D_Hair.geometry}           material={materials.Wolf3D_Hair}           skeleton={nodes.Wolf3D_Hair.skeleton} />
      <skinnedMesh name="EyeLeft"               geometry={nodes.EyeLeft.geometry}               material={materials.Wolf3D_Eye}            skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}   morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}/>
      <skinnedMesh name="EyeRight"              geometry={nodes.EyeRight.geometry}              material={materials.Wolf3D_Eye}            skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}  morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}/>
      <skinnedMesh name="Wolf3D_Head"           geometry={nodes.Wolf3D_Head.geometry}           material={materials.Wolf3D_Skin}          skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}/>
      <skinnedMesh name="Wolf3D_Teeth"          geometry={nodes.Wolf3D_Teeth.geometry}          material={materials.Wolf3D_Teeth}         skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}/>
    </group>
  );
}

useGLTF.preload("/models/68dd0d74c0cc7f0f2779fce7.glb");
