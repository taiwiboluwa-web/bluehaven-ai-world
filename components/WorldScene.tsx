"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Sparkles, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Project = {
  id: string;
  name: string;
  kind: string;
  status: string;
  description: string;
  tone: string;
  gridX?: number;
  gridZ?: number;
};
type Props = { projects: Project[]; buildingId: string | null; onSelect: (id: string) => void };
const fallbackPlots: [number, number][] = [[-2,-1],[2,-1],[-2,2],[2,2],[0,-3],[0,3],[-4,0],[4,0]];

function Tile({position,color="#75a957"}:{position:[number,number,number];color?:string}) {
  return <mesh position={position} receiveShadow><boxGeometry args={[.96,.12,.96]}/><meshStandardMaterial color={color} roughness={1}/></mesh>;
}
function Tree({position,scale=1}:{position:[number,number,number];scale?:number}) {
  return <group position={position} scale={scale}>
    <mesh position={[0,.31,0]} castShadow><cylinderGeometry args={[.075,.13,.62,9]}/><meshStandardMaterial color="#6f4a31" roughness={1}/></mesh>
    <mesh position={[0,.7,0]} castShadow><sphereGeometry args={[.42,12,10]}/><meshStandardMaterial color="#2c6948" roughness={1}/></mesh>
    <mesh position={[-.2,.91,.04]} castShadow><sphereGeometry args={[.29,10,9]}/><meshStandardMaterial color="#367a4e" roughness={1}/></mesh>
    <mesh position={[.2,.93,-.04]} castShadow><sphereGeometry args={[.3,10,9]}/><meshStandardMaterial color="#438653" roughness={1}/></mesh>
    <mesh position={[0,1.13,0]} castShadow><sphereGeometry args={[.29,10,9]}/><meshStandardMaterial color="#4d925b" roughness={1}/></mesh>
  </group>;
}
function House({position,kind=0,scale=1}:{position:[number,number,number];kind?:number;scale?:number}) {
  const walls=["#c6a77d","#b7b6a8","#b4a0cf","#d2b977"];
  const roofs=["#69443a","#4b5960","#59408b","#8b563c"];
  const trim=["#e4cfaa","#d9d8c8","#d4c7ed","#f0dfa9"];
  return <group position={position} scale={scale}>
    <mesh position={[0,.13,0]} castShadow receiveShadow><boxGeometry args={[.9,.16,.82]}/><meshStandardMaterial color="#746d58" roughness={1}/></mesh>
    <mesh position={[0,.48,0]} castShadow receiveShadow><boxGeometry args={[.76,.62,.68]}/><meshStandardMaterial color={walls[kind%4]} roughness={.92}/></mesh>
    <mesh position={[0,.84,0]} castShadow><coneGeometry args={[.64,.57,4]}/><meshStandardMaterial color={roofs[kind%4]} roughness={.88}/></mesh>
    <mesh position={[0,.56,.347]}><boxGeometry args={[.2,.38,.025]}/><meshStandardMaterial color="#563b2b" roughness={.85}/></mesh>
    <mesh position={[0,.56,.365]}><boxGeometry args={[.15,.31,.018]}/><meshStandardMaterial color="#765039" roughness={.9}/></mesh>
    <mesh position={[.235,.55,.355]}><boxGeometry args={[.15,.17,.035]}/><meshStandardMaterial color={trim[kind%4]} roughness={.8}/></mesh>
    <mesh position={[.235,.55,.377]}><boxGeometry args={[.105,.125,.02]}/><meshStandardMaterial color="#6da8b0" emissive="#31545a" emissiveIntensity={.18} roughness={.3}/></mesh>
    <mesh position={[.235,.55,.39]}><boxGeometry args={[.018,.14,.018]}/><meshStandardMaterial color={trim[kind%4]}/></mesh>
    <mesh position={[.235,.55,.39]}><boxGeometry args={[.12,.018,.018]}/><meshStandardMaterial color={trim[kind%4]}/></mesh>
    <mesh position={[-.23,.55,.355]}><boxGeometry args={[.13,.16,.035]}/><meshStandardMaterial color={trim[kind%4]} roughness={.8}/></mesh>
    <mesh position={[-.23,.55,.377]}><boxGeometry args={[.09,.115,.02]}/><meshStandardMaterial color="#6da8b0" emissive="#31545a" emissiveIntensity={.18} roughness={.3}/></mesh>
    <mesh position={[-.23,.55,.39]}><boxGeometry args={[.015,.13,.018]}/><meshStandardMaterial color={trim[kind%4]}/></mesh>
    <mesh position={[-.23,.55,.39]}><boxGeometry args={[.11,.015,.018]}/><meshStandardMaterial color={trim[kind%4]}/></mesh>
    <mesh position={[.25,1.05,-.16]} castShadow><boxGeometry args={[.14,.42,.15]}/><meshStandardMaterial color="#9b8c78" roughness={1}/></mesh>
    <mesh position={[.25,1.27,-.16]}><boxGeometry args={[.17,.06,.18]}/><meshStandardMaterial color="#655a4c" roughness={1}/></mesh>
    <mesh position={[0,1.2,0]}><sphereGeometry args={[.075,12,12]}/><meshStandardMaterial color={kind%2?"#b9a6ff":"#ffdf69"} emissive={kind%2?"#6d55b0":"#ffbd51"} emissiveIntensity={.45}/></mesh>
  </group>;
}
function ProjectBuilding({position,project,index,onSelect,building}:{position:[number,number,number];project:Project;index:number;onSelect:(id:string)=>void;building:boolean}) {
  const ref=useRef<THREE.Group>(null);
  const tone=project.status==="failed"?"#ff6e61":project.tone==="mint"?"#83dbb5":project.tone==="violet"?"#b29bff":"#ffdf69";
  useFrame((state,delta)=>{if(ref.current){ref.current.rotation.y += delta*(building ? .16 : .025);if(building)ref.current.position.y=position[1]+.08+Math.sin(state.clock.elapsedTime*5)*.035;}});
  return <group ref={ref} position={position} onClick={(e)=>{e.stopPropagation();onSelect(project.id)}}>
    <mesh position={[0,.04,0]}><cylinderGeometry args={[.72,.8,.12,8]}/><meshStandardMaterial color={building?"#c58b43":"#8b9275"} roughness={.9}/></mesh>
    {building ? <>
      <mesh position={[0,.55,0]}><boxGeometry args={[.9,1,.9]}/><meshStandardMaterial color="#bc985b" wireframe transparent opacity={.7}/></mesh>
      <mesh position={[0,1.08,0]}><boxGeometry args={[1.05,.06,1.05]}/><meshStandardMaterial color="#a97b42"/></mesh>
      <Sparkles count={18} scale={1.4} size={2.5} speed={.7} color="#ffdf69"/>
    </> : <>
      <House position={[0,.12,0]} kind={index+1} scale={.85}/>
      <mesh position={[0,1.43,0]}><sphereGeometry args={[.08,12,12]}/><meshBasicMaterial color={tone}/></mesh>
      <Sparkles count={5} scale={[.9,.3,.9]} position={[0,1.4,0]} size={2} speed={.25} color={tone}/>
    </>}
  </group>;
}
function Village({projects,buildingId,onSelect}:{projects:Project[];buildingId:string|null;onSelect:(id:string)=>void}) {
  const grass=useMemo(()=>Array.from({length:144},(_,i)=>({x:(i%12)-5.5,z:Math.floor(i/12)-5.5})),[]);
  const forest=useMemo(()=>Array.from({length:60},(_,i)=>({x:Math.cos(i*2.4)*(6.3+(i%3)*.4),z:Math.sin(i*2.4)*(5.9+(i%4)*.3),s:.65+(i%5)*.09})),[]);
  const constructionProject=projects.find((project)=>project.id===buildingId);
  return <group rotation={[0,-.12,0]}>
    {grass.map((t,i)=><Tile key={i} position={[t.x*.94,-.08,t.z*.94]} color={(Math.floor(t.x+t.z)%4===0)?"#83b760":(Math.floor(t.x-t.z)%5===0)?"#78ad54":"#8abd63"}/>)}
    {grass.filter(t=>Math.abs(t.x)<4.4&&Math.abs(t.z)<4.4&&Math.abs(t.x-t.z)<1).map((t,i)=><mesh key={"path"+i} position={[t.x*.94,-.012,t.z*.94]}><boxGeometry args={[.22,.015,.22]}/><meshStandardMaterial color="#b6a77e" roughness={1}/></mesh>)}
    {forest.map((t,i)=><Tree key={i} position={[t.x,-.02,t.z]} scale={t.s}/>)}
    <BuilderHut/>
    <Hub/>
    {projects.map((p,i)=>{
      const plot=fallbackPlots[i%fallbackPlots.length];
      const x=typeof p.gridX==="number"?p.gridX:plot[0];
      const z=typeof p.gridZ==="number"?p.gridZ:plot[1];
      const building=p.id===buildingId||["under_construction","initializing"].includes(p.status);
      return <ProjectBuilding key={p.id} position={[x,.02,z]} project={p} index={i} onSelect={onSelect} building={building}/>;
    })}
    {constructionProject && <TravellingBuilder key={constructionProject.id} start={[-4.65,-4.65]} target={[constructionProject.gridX ?? 0,constructionProject.gridZ ?? 0]}/>}
    <ContactShadows position={[0,-.005,0]} opacity={.32} scale={14} blur={2.5} far={4}/>
  </group>;
}
export default function WorldScene({projects,buildingId,onSelect}:Props) {
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[8,8,10],fov:35}} gl={{antialias:true,alpha:true}}>
    <color attach="background" args={["#182638"]}/><fog attach="fog" args={["#182638",14,24]}/>
    <ambientLight intensity={1.6}/><hemisphereLight args={["#d6e7ff","#385b38",1.2]}/>
    <directionalLight position={[5,9,6]} intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
    <Suspense fallback={null}><Float speed={.45} rotationIntensity={.012} floatIntensity={.025}><Village projects={projects} buildingId={buildingId} onSelect={onSelect}/></Float></Suspense>
    <OrbitControls makeDefault enablePan={false} minDistance={9} maxDistance={17} minPolarAngle={.65} maxPolarAngle={1.2} target={[0,.3,0]} enableDamping dampingFactor={.08}/>
  </Canvas>;
}
