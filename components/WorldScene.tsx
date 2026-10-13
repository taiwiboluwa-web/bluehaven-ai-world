"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, Sparkles } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

type Project = {
  id: string; name: string; kind: string; status: string; description: string; tone: string;
  gridX?: number; gridZ?: number;
};
type Props = { projects: Project[]; buildingId: string | null; onSelect: (id: string) => void };
const plots: [number, number][] = [[-3.2,-2.3],[3.1,-2.5],[-3.4,2.4],[3.25,2.45],[0,-4.1],[0,4.05],[-4.5,.1],[4.45,.15]];

function Material({color,roughness=.85,metalness=0,emissive,emissiveIntensity=0}:{color:string;roughness?:number;metalness?:number;emissive?:string;emissiveIntensity?:number}) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity}/>;
}
function Tree({position,scale=1,autumn=false}:{position:[number,number,number];scale?:number;autumn?:boolean}) {
  const greens=autumn?["#9e7648","#bd965b","#d0aa6b"]:["#285a43","#33764f","#43885a"];
  return <group position={position} scale={scale}>
    <mesh position={[0,.34,0]} castShadow><cylinderGeometry args={[.09,.15,.68,8]}/><Material color="#74503a"/></mesh>
    <mesh position={[0,.83,0]} castShadow><icosahedronGeometry args={[.43,1]}/><Material color={greens[0]}/></mesh>
    <mesh position={[-.22,1.02,.02]} castShadow><icosahedronGeometry args={[.31,1]}/><Material color={greens[1]}/></mesh>
    <mesh position={[.2,1.03,-.05]} castShadow><icosahedronGeometry args={[.3,1]}/><Material color={greens[2]}/></mesh>
    <mesh position={[0,1.26,0]} castShadow><icosahedronGeometry args={[.28,1]}/><Material color={greens[1]}/></mesh>
  </group>;
}
function House({position,kind=0,scale=1}:{position:[number,number,number];kind?:number;scale?:number}) {
  const walls=["#d7c3a0","#c6c9bf","#b9afd5","#d9c78e"];
  const roofs=["#4d4642","#5c6870","#65518a","#8d5943"];
  const trim=["#f0dfbc","#e7e7dc","#e2d8f6","#f5e7b8"];
  return <group position={position} scale={scale}>
    <mesh position={[0,.1,0]} receiveShadow castShadow><boxGeometry args={[1.1,.18,1.02]}/><Material color="#8c8977"/></mesh>
    <mesh position={[0,.55,0]} receiveShadow castShadow><boxGeometry args={[.91,.78,.82]}/><Material color={walls[kind%4]} roughness={.95}/></mesh>
    <mesh position={[0,1.01,0]} castShadow><coneGeometry args={[.79,.62,4]}/><Material color={roofs[kind%4]} roughness={.91}/></mesh>
    <mesh position={[0,.49,.417]}><boxGeometry args={[.19,.45,.025]}/><Material color="#604532"/></mesh>
    <mesh position={[0,.47,.435]}><boxGeometry args={[.12,.34,.02]}/><Material color="#987052"/></mesh>
    {[-.29,.29].map((x,i)=><group key={i} position={[x,.63,.425]}>
      <mesh><boxGeometry args={[.19,.2,.035]}/><Material color={trim[kind%4]}/></mesh>
      <mesh position={[0,0,.023]}><boxGeometry args={[.135,.145,.018]}/><Material color="#80b7bf" roughness={.28} metalness={.12} emissive="#315d63" emissiveIntensity={.16}/></mesh>
      <mesh position={[0,0,.035]}><boxGeometry args={[.014,.16,.012]}/><Material color={trim[kind%4]}/></mesh>
      <mesh position={[0,0,.035]}><boxGeometry args={[.15,.014,.012]}/><Material color={trim[kind%4]}/></mesh>
    </group>)}
    <mesh position={[.28,1.23,-.2]} castShadow><boxGeometry args={[.16,.46,.17]}/><Material color="#a99a86"/></mesh>
    <mesh position={[.28,1.48,-.2]}><boxGeometry args={[.19,.055,.2]}/><Material color="#5e5a54"/></mesh>
    <mesh position={[0,1.26,0]}><sphereGeometry args={[.065,12,12]}/><Material color={kind%2?"#b7a5ff":"#ffdb79"} emissive={kind%2?"#6651b6":"#d9a33e"} emissiveIntensity={.8}/></mesh>
  </group>;
}
function Agent({start,color,phase=0}:{start:[number,number,number];color:string;phase?:number}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(ref.current){const t=clock.elapsedTime*.24+phase;ref.current.position.x=start[0]+Math.sin(t)*.6;ref.current.position.z=start[2]+Math.cos(t*1.13)*.55;ref.current.position.y=start[1]+.1+Math.abs(Math.sin(t*3))*.08;ref.current.rotation.y=-t*.8;}});
  return <group ref={ref} position={start}>
    <mesh position={[0,.12,0]} castShadow><capsuleGeometry args={[.105,.2,4,8]}/><Material color={color} metalness={.25} roughness={.35}/></mesh>
    <mesh position={[0,.34,.015]} castShadow><sphereGeometry args={[.105,16,12]}/><Material color="#d9e8e3" metalness={.18} roughness={.25}/></mesh>
    <mesh position={[0,.34,.11]}><sphereGeometry args={[.045,12,8]}/><Material color={color} emissive={color} emissiveIntensity={1.1}/></mesh>
    <mesh position={[0,-.02,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.13,.18,20]}/><meshBasicMaterial color={color} transparent opacity={.65}/></mesh>
  </group>;
}
function HQ() {
  return <group position={[0,0,0]}>
    <mesh position={[0,.08,0]} receiveShadow><cylinderGeometry args={[1.55,1.68,.16,8]}/><Material color="#9a8b69"/></mesh>
    <mesh position={[0,.2,0]}><cylinderGeometry args={[1.38,1.38,.08,8]}/><Material color="#c2b18a"/></mesh>
    <mesh position={[0,.83,0]} castShadow receiveShadow><boxGeometry args={[1.62,1.18,1.4]}/><Material color="#d7d0b9" roughness={.7}/></mesh>
    <mesh position={[0,1.55,0]} castShadow><coneGeometry args={[1.2,.72,4]}/><Material color="#263c43" metalness={.2} roughness={.55}/></mesh>
    <mesh position={[0,1.08,.711]}><boxGeometry args={[.3,.63,.035]}/><Material color="#72513c"/></mesh>
    {[-.52,.52].map(x=><mesh key={x} position={[x,1.05,.715]}><boxGeometry args={[.28,.35,.035]}/><Material color="#7ebbc0" emissive="#345c62" emissiveIntensity={.3} roughness={.3}/></mesh>)}
    <mesh position={[0,2.02,0]}><cylinderGeometry args={[.035,.035,.55,8]}/><Material color="#d9c28a" metalness={.6}/></mesh>
    <mesh position={[0,2.25,0]}><octahedronGeometry args={[.13,0]}/><Material color="#ffda79" emissive="#dca83e" emissiveIntensity={1.1}/></mesh>
    <Sparkles count={22} position={[0,1.7,0]} scale={[2.3,1.4,2.3]} size={2.2} speed={.25} color="#ffe6a3"/>
  </group>;
}
function Road({from,to,width=.55}:{from:[number,number];to:[number,number];width?:number}) {
  const dx=to[0]-from[0], dz=to[1]-from[1], length=Math.hypot(dx,dz), angle=-Math.atan2(dz,dx);
  return <group position={[(from[0]+to[0])/2,-.005,(from[1]+to[1])/2]} rotation={[0,angle,0]}>
    <mesh receiveShadow><boxGeometry args={[length,.035,width]}/><Material color="#b9b09b" roughness={1}/></mesh>
    <mesh position={[0,.02,0]}><boxGeometry args={[length,.012,width*.72]}/><Material color="#d4cbb4" roughness={1}/></mesh>
    {Array.from({length:Math.max(1,Math.floor(length/1.1))},(_,i)=><mesh key={i} position={[-length/2+.55+i*1.1,.03,0]}><boxGeometry args={[.38,.008,.025]}/><Material color="#f5e6c1" roughness={1}/></mesh>)}
  </group>;
}
function ProjectBuilding({position,project,index,onSelect,building}:{position:[number,number,number];project:Project;index:number;onSelect:(id:string)=>void;building:boolean}) {
  const ref=useRef<THREE.Group>(null);
  const tone=project.status==="failed"?"#ff766c":project.tone==="mint"?"#83dbb5":project.tone==="violet"?"#b9a5ff":"#ffdf79";
  useFrame((state,delta)=>{if(ref.current){ref.current.rotation.y += delta*(building?.18:.012);if(building)ref.current.position.y=position[1]+.06+Math.sin(state.clock.elapsedTime*4)*.025;}});
  return <group ref={ref} position={position} onClick={(e)=>{e.stopPropagation();onSelect(project.id)}}>
    <mesh position={[0,.06,0]} castShadow receiveShadow><cylinderGeometry args={[.85,.92,.16,8]}/><Material color={building?"#bd8c47":"#8b9278"}/></mesh>
    <mesh position={[0,.15,0]}><ringGeometry args={[.72,.8,8]}/><meshBasicMaterial color={tone} transparent opacity={.8}/></mesh>
    {building?<><mesh position={[0,.72,0]} castShadow><boxGeometry args={[1,1.05,1]}/><meshStandardMaterial color="#e7c982" wireframe transparent opacity={.55}/></mesh><mesh position={[0,1.27,0]}><boxGeometry args={[1.12,.07,1.12]}/><Material color="#d2a85c"/></mesh><Sparkles count={20} scale={1.55} size={2.4} speed={.8} color="#ffdf79"/></>:<><House position={[0,.14,0]} kind={index+1} scale={.82}/><mesh position={[0,1.57,0]}><sphereGeometry args={[.065,12,12]}/><meshBasicMaterial color={tone}/></mesh><Sparkles count={project.status==="active"?7:3} scale={[.8,.3,.8]} position={[0,1.45,0]} size={1.6} speed={.22} color={tone}/></>}
  </group>;
}
function World({projects,buildingId,onSelect}:{projects:Project[];buildingId:string|null;onSelect:(id:string)=>void}) {
  const ground=useMemo(()=>Array.from({length:19*19},(_,i)=>({x:i%19-9,z:Math.floor(i/19)-9})),[]);
  const forest=useMemo(()=>Array.from({length:56},(_,i)=>{const a=i*2.399;const r=7.5+(i%4)*.45;return {x:Math.cos(a)*r,z:Math.sin(a)*r,s:.62+(i%5)*.095};}),[]);
  const occupied=projects.map((p,i)=>({p,i,plot:plots[i%plots.length]}));
  return <group>
    <mesh position={[0,-.32,0]} receiveShadow><cylinderGeometry args={[11.9,12.2,.7,12]}/><Material color="#3a5149" roughness={1}/></mesh>
    <mesh position={[0,-.1,0]} receiveShadow><cylinderGeometry args={[11.5,11.8,.22,12]}/><Material color="#719568" roughness={1}/></mesh>
    {ground.map((t,i)=><mesh key={i} position={[t.x*.58,-.015,t.z*.58]} receiveShadow><boxGeometry args={[.56,.04,.56]}/><Material color={(i%7===0)?"#86a96d":(i%5===0)?"#83a96b":"#7da365"} roughness={1}/></mesh>)}
    <Road from={[0,0]} to={[0,-5.9]} width={.62}/>
    <Road from={[0,0]} to={[0,5.8]} width={.62}/>
    <Road from={[0,0]} to={[-5.9,0]} width={.62}/>
    <Road from={[0,0]} to={[5.9,0]} width={.62}/>
    <Road from={[-3.2,-2.3]} to={[0,0]} width={.48}/>
    <Road from={[3.1,-2.5]} to={[0,0]} width={.48}/>
    <Road from={[-3.4,2.4]} to={[0,0]} width={.48}/>
    <Road from={[3.25,2.45]} to={[0,0]} width={.48}/>
    {forest.map((t,i)=><Tree key={i} position={[t.x,-.02,t.z]} scale={t.s} autumn={i%7===0}/>)}
    <HQ/>
    {occupied.map(({p,i,plot})=>{const x=typeof p.gridX==="number"?p.gridX:plot[0];const z=typeof p.gridZ==="number"?p.gridZ:plot[1];const building=p.id===buildingId||["under_construction","initializing"].includes(p.status);return <ProjectBuilding key={p.id} position={[x,.02,z]} project={p} index={i} onSelect={onSelect} building={building}/>;})}
    {[[ -5.7,-5.3], [5.65,-5.4],[-5.7,5.3],[5.65,5.4]].map((p,i)=><group key={i} position={[p[0],0,p[1]]}><mesh position={[0,.3,0]} castShadow><cylinderGeometry args={[.12,.16,.6,8]}/><Material color="#b9a16d" metalness={.35}/></mesh><mesh position={[0,.65,0]}><sphereGeometry args={[.13,12,10]}/><Material color="#ffe6a0" emissive="#ffcf62" emissiveIntensity={1.2}/></mesh><pointLight position={[0,.75,0]} color="#ffd887" intensity={.45} distance={2}/></group>)}
    <Agent start={[-1.5,.05,-1.2]} color="#f3c969" phase={0}/>
    <Agent start={[1.7,.05,1.2]} color="#8ce0b0" phase={2.3}/>
    <Agent start={[-1.2,.05,1.6]} color="#a9a1ff" phase={4.4}/>
    <ContactShadows position={[0,-.02,0]} opacity={.3} scale={23} blur={2.8} far={6}/>
  </group>;
}
export default function WorldScene({projects,buildingId,onSelect}:Props) {
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[11,11,13],fov:34}} gl={{antialias:true,alpha:true}} onCreated={({gl})=>{gl.setClearColor("#17252a",1);}}>
    <color attach="background" args={["#17252a"]}/><fog attach="fog" args={["#17252a",20,33]}/>
    <ambientLight intensity={.8}/><hemisphereLight args={["#d9e8ff","#40533d",1.2]}/>
    <directionalLight position={[7,13,5]} intensity={2.1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={13} shadow-camera-bottom={-13}/>
    <Suspense fallback={null}><Float speed={.25} rotationIntensity={.006} floatIntensity={.012}><World projects={projects} buildingId={buildingId} onSelect={onSelect}/></Float></Suspense>
    <OrbitControls makeDefault enablePan={false} minDistance={10} maxDistance={21} minPolarAngle={.55} maxPolarAngle={1.23} target={[0,.35,0]} enableDamping dampingFactor={.075}/>
  </Canvas>;
}
