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
    <mesh position={[0,.32,0]} castShadow><cylinderGeometry args={[.09,.13,.65,7]}/><meshStandardMaterial color="#76513a"/></mesh>
    <mesh position={[0,.82,0]} castShadow><coneGeometry args={[.43,.95,7]}/><meshStandardMaterial color="#2d784d" roughness={1}/></mesh>
    <mesh position={[0,1.18,0]} castShadow><coneGeometry args={[.31,.7,7]}/><meshStandardMaterial color="#43945a" roughness={1}/></mesh>
  </group>;
}
function House({position,kind=0,scale=1}:{position:[number,number,number];kind?:number;scale?:number}) {
  const colors=["#bd8b51","#a6a1b7","#8b78cb","#d5b55f"];
  const roofs=["#70443a","#55506e","#6246a0","#8d5a39"];
  return <group position={position} scale={scale}>
    <mesh position={[0,.38,0]} castShadow receiveShadow><boxGeometry args={[.76,.65,.68]}/><meshStandardMaterial color={colors[kind%4]} roughness={.82}/></mesh>
    <mesh position={[0,.86,0]} castShadow><coneGeometry args={[.63,.6,4]}/><meshStandardMaterial color={roofs[kind%4]} roughness={.9}/></mesh>
    <mesh position={[0,.36,.348]}><boxGeometry args={[.19,.36,.025]}/><meshStandardMaterial color="#50372e"/></mesh>
    <mesh position={[.22,.48,.355]}><boxGeometry args={[.1,.12,.025]}/><meshStandardMaterial color="#ffdc78" emissive="#ffbd51" emissiveIntensity={.3}/></mesh>
    <mesh position={[0,1.2,0]}><sphereGeometry args={[.09,12,12]}/><meshStandardMaterial color={kind%2?"#a99aff":"#ffdf69"} emissive={kind%2?"#a99aff":"#ffdf69"} emissiveIntensity={.8}/></mesh>
  </group>;
}
function Builder({position}:{position:[number,number,number]}) {
  const ref=useRef<THREE.Group>(null);
  useFrame((state)=>{if(ref.current){ref.current.rotation.z=Math.sin(state.clock.elapsedTime*8)*.18;ref.current.position.y=.2+Math.abs(Math.sin(state.clock.elapsedTime*5))*.06;}});
  return <group ref={ref} position={position}>
    <mesh position={[0,.24,0]} castShadow><capsuleGeometry args={[.09,.19,4,8]}/><meshStandardMaterial color="#d4a15f"/></mesh>
    <mesh position={[0,.44,0]} castShadow><sphereGeometry args={[.105,12,12]}/><meshStandardMaterial color="#e9bc86"/></mesh>
    <mesh position={[0,.54,0]}><coneGeometry args={[.14,.13,5]}/><meshStandardMaterial color="#8d5735"/></mesh>
    <mesh position={[.16,.3,0]} rotation={[0,0,-.7]}><boxGeometry args={[.05,.25,.05]}/><meshStandardMaterial color="#a36d3e"/></mesh>
    <mesh position={[.25,.42,0]} rotation={[0,0,.5]}><boxGeometry args={[.055,.18,.055]}/><meshStandardMaterial color="#b9b6c6"/></mesh>
  </group>;
}
function BuilderHut() {
  return <group position={[-4.65,0,-4.65]}>
    <mesh position={[0,.08,0]}><cylinderGeometry args={[.62,.7,.12,8]}/><meshStandardMaterial color="#8a7049"/></mesh>
    <House position={[0,.12,0]} kind={0} scale={.78}/>
    <mesh position={[.48,.42,.25]} rotation={[0,-.25,0]}><boxGeometry args={[.22,.28,.05]}/><meshStandardMaterial color="#8b633b"/></mesh>
    <Builder position={[.72,0,.38]}/>
  </group>;
}
function TravellingBuilder({start,target}:{start:[number,number];target:[number,number]}) {
  const ref=useRef<THREE.Group>(null);
  const startTime=useRef<number|null>(null);
  useFrame((state)=>{
    if(!ref.current) return;
    if(startTime.current===null) startTime.current=state.clock.elapsedTime;
    const elapsed=(state.clock.elapsedTime-startTime.current)%7;
    const outbound=Math.min(1,elapsed/2.25);
    const returning=Math.max(0,Math.min(1,(elapsed-5.1)/1.7));
    let x=start[0], z=start[1];
    if(elapsed<2.25){x=start[0]+(target[0]-start[0])*outbound;z=start[1]+(target[1]-start[1])*outbound;}
    else if(elapsed<5.1){x=target[0];z=target[1];}
    else{x=target[0]+(start[0]-target[0])*returning;z=target[1]+(start[1]-target[1])*returning;}
    ref.current.position.set(x,.015,z);
    if(elapsed<2.25) ref.current.rotation.y=Math.atan2(target[0]-start[0],target[1]-start[1]);
    else if(elapsed>=5.1) ref.current.rotation.y=Math.atan2(start[0]-target[0],start[1]-target[1]);
    ref.current.scale.setScalar(elapsed>=2.25&&elapsed<5.1?1.08:1);
  });
  return <group ref={ref}><Builder position={[0,0,0]}/></group>;
}
function Hub() {
  return <group position={[0,0,0]}>
    <mesh position={[0,.12,0]}><cylinderGeometry args={[1.0,1.13,.2,8]}/><meshStandardMaterial color="#c6a15c" roughness={.8}/></mesh>
    <House position={[0,.2,0]} kind={3} scale={1.3}/>
    <mesh position={[0,1.9,0]}><octahedronGeometry args={[.2,1]}/><meshStandardMaterial color="#ffdf69" emissive="#ffb52f" emissiveIntensity={1.5} metalness={.25}/></mesh>
    <Sparkles count={22} scale={[2.3,2.5,2.3]} size={2} speed={.3} color="#ffdf69"/>
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
