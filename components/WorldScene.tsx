"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, RoundedBox, Sparkles } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import PF from "pathfinding";

type Project = {
  id: string; name: string; kind: string; status: string; description: string; tone: string;
  gridX?: number; gridZ?: number;
};
type DistrictId = "hq" | "builder" | "archive" | "infrastructure";
type Props = { projects: Project[]; buildingId: string | null; onSelect: (id: string) => void; onDistrictSelect: (id: DistrictId) => void };
const plots: [number, number][] = [[-3.2,-2.3],[3.1,-2.5],[-3.4,2.4],[3.25,2.45],[0,-4.1],[0,4.05],[-4.5,.1],[4.45,.15]];

function Material({color,roughness=.85,metalness=0,emissive,emissiveIntensity=0}:{color:string;roughness?:number;metalness?:number;emissive?:string;emissiveIntensity?:number}) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity}/>;
}
function Tree({position,scale=1,autumn=false}:{position:[number,number,number];scale?:number;autumn?:boolean}) {
  const greens=autumn?["#9e7648","#bd965b","#d0aa6b"]:["#347448","#438b4f","#5aa65b"];
  return <group position={position} scale={scale}>
    <mesh position={[0,.34,0]} castShadow><cylinderGeometry args={[.09,.15,.68,8]}/><Material color="#74503a"/></mesh>
    <mesh position={[0,.83,0]} castShadow><icosahedronGeometry args={[.43,1]}/><Material color={greens[0]}/></mesh>
    <mesh position={[-.22,1.02,.02]} castShadow><icosahedronGeometry args={[.31,1]}/><Material color={greens[1]}/></mesh>
    <mesh position={[.2,1.03,-.05]} castShadow><icosahedronGeometry args={[.3,1]}/><Material color={greens[2]}/></mesh>
    <mesh position={[0,1.26,0]} castShadow><icosahedronGeometry args={[.28,1]}/><Material color={greens[1]}/></mesh>
  </group>;
}
function House({position,kind=0,scale=1}:{position:[number,number,number];kind?:number;scale?:number}) {
  const walls=["#e9d9b8","#d1e2d0","#d7c9ef","#f0d8a7","#c8e0e5","#e6dfd1"];
  const roofs=["#a94737","#355d7a","#7651a3","#b66c35","#367c70","#354a59"];
  const accents=["#f3c969","#80dcb6","#c2a5ff","#ffc45d","#6ed8e4","#f3d59a"];
  const wall=walls[kind%walls.length], roof=roofs[kind%roofs.length], accent=accents[kind%accents.length];
  const Block=({p,s,color,r=.025,rough=.75,metal=0,emissive,glow=0}:{p:[number,number,number];s:[number,number,number];color:string;r?:number;rough?:number;metal?:number;emissive?:string;glow?:number})=><RoundedBox position={p} args={s} radius={r} smoothness={3} castShadow receiveShadow><Material color={color} roughness={rough} metalness={metal} emissive={emissive} emissiveIntensity={glow}/></RoundedBox>;
  return <group position={position} scale={scale}>
    {/* Heavy layered foundation, with visible bevels and a warm metallic reveal. */}
    <Block p={[0,.12,0]} s={[1.22,.22,1.13]} color="#8d9483" r={.055}/>
    <Block p={[0,.245,0]} s={[1.12,.065,1.04]} color="#e1cfaa" r={.025} rough={.62}/>
    <Block p={[0,.65,0]} s={[.96,.75,.84]} color={wall} r={.055} rough={.86}/>
    {/* Recessed glass curtain wall: separate panes, mullions and frame create real depth. */}
    <Block p={[0,.69,.426]} s={[.72,.54,.035]} color="#5a756e" r={.018} rough={.2} metal={.15} emissive="#3a7c7a" glow={.12}/>
    {[-.27,-.09,.09,.27].map((x,i)=><Block key={"glass-"+i} p={[x,.69,.45]} s={[.145,.46,.022]} color={i%2?"#86c9c5":"#6ca8b3"} r={.009} rough={.19} metal={.12} emissive="#4c9b9d" glow={.13}/>)}
    {[-.18,.18].map(x=><Block key={"mullion-"+x} p={[x,.69,.466]} s={[.025,.53,.028]} color="#ead6a4" r={.007} metal={.32}/>)}
    <Block p={[0,.69,.468]} s={[.74,.035,.03]} color="#f1dfb4" r={.008} metal={.24}/>
    {/* Front portal and canopy. */}
    <Block p={[0,.43,.46]} s={[.22,.47,.06]} color="#3c4c4b" r={.025} rough={.5} metal={.15}/>
    <Block p={[0,.43,.495]} s={[.14,.34,.018]} color="#80bfc0" r={.012} rough={.18} metal={.15} emissive="#3d7e83" glow={.2}/>
    <Block p={[0,.91,.51]} s={[.67,.085,.24]} color={roof} r={.025} rough={.48} metal={.16}/>
    <Block p={[0,.86,.63]} s={[.69,.025,.025]} color={accent} r={.008} metal={.28} emissive={accent} glow={.25}/>
    {[-.43,.43].map((x,i)=><group key={"column-"+i}>
      <Block p={[x,.65,.44]} s={[.075,.72,.09]} color="#f1e4c8" r={.018} rough={.65}/>
      <Block p={[x,.99,.45]} s={[.13,.065,.13]} color={accent} r={.014} metal={.28}/>
      <Block p={[x,.68,.496]} s={[.025,.15,.02]} color={accent} r={.006} emissive={accent} glow={.3}/>
    </group>)}
    {/* Roof slab, parapet, planted inset and mechanical equipment. */}
    <Block p={[0,1.055,0]} s={[1.12,.15,1.0]} color={roof} r={.045} rough={.48} metal={.16}/>
    <Block p={[0,1.145,0]} s={[.86,.045,.75]} color="#628c59" r={.025} rough={.92}/>
    {[-.48,.48].map(x=><Block key={"parapet-x-"+x} p={[x,1.17,0]} s={[.075,.12,.94]} color={accent} r={.014} metal={.25}/>)}
    <Block p={[0,1.17,-.43]} s={[.96,.12,.07]} color={accent} r={.014} metal={.25}/>
    <Block p={[.24,1.25,-.18]} s={[.28,.17,.26]} color="#354744" r={.025} rough={.45} metal={.32}/>
    {[-.07,0,.07].map(x=><Block key={"vent-"+x} p={[.24+x,1.345,-.18]} s={[.025,.025,.19]} color="#d8c9a5" r={.006} metal={.35}/>)}
    <Block p={[-.27,1.25,-.15]} s={[.13,.14,.18]} color="#e6dfca" r={.018}/>
    <Block p={[-.27,1.335,-.15]} s={[.16,.025,.2]} color={accent} r={.008} metal={.28}/>
    {/* Tiny glowing rooftop beacon makes the building feel like an active game asset. */}
    <mesh position={[0,1.38,.05]} castShadow><cylinderGeometry args={[.035,.05,.09,8]}/><Material color="#d5c49d" metalness={.45} roughness={.3}/></mesh>
    <mesh position={[0,1.46,.05]} castShadow><icosahedronGeometry args={[.075,1]}/><Material color={accent} roughness={.22} metalness={.2} emissive={accent} emissiveIntensity={.9}/></mesh>
    <Sparkles count={kind%3===1?5:3} position={[0,1.44,.05]} scale={[.3,.28,.3]} size={1.5} speed={.2} color={accent}/>
    {/* Side service panels and layered trim catch the key light as the camera orbits. */}
    <Block p={[-.493,.63,0]} s={[.035,.53,.42]} color={roof} r={.012} rough={.5}/>
    <Block p={[.493,.63,0]} s={[.035,.53,.42]} color={roof} r={.012} rough={.5}/>
    <Block p={[0,.285,.02]} s={[1.14,.045,1.06]} color={accent} r={.012} metal={.22}/>
    <Block p={[0,.16,.61]} s={[.48,.09,.2]} color="#d5c3a0" r={.025}/>
    <Block p={[0,.11,.73]} s={[.38,.07,.16]} color="#b8a581" r={.02}/>
  </group>;
}
function Agent({start,color,phase=0,destination}:{start:[number,number,number];color:string;phase?:number;destination:[number,number]}) {
  const ref=useRef<THREE.Group>(null);
  const limbs=useRef<THREE.Group>(null);
  const route=useMemo(() => {
    const grid = new PF.Grid(19, 19);
    for (let x = 8; x <= 10; x++) for (let z = 8; z <= 10; z++) grid.setWalkableAt(x, z, false);
    const from = [Math.max(0, Math.min(18, Math.round(start[0] + 9))), Math.max(0, Math.min(18, Math.round(start[2] + 9)))];
    const to = [Math.max(0, Math.min(18, Math.round(destination[0] + 9))), Math.max(0, Math.min(18, Math.round(destination[1] + 9)))];
    grid.setWalkableAt(from[0], from[1], true);
    grid.setWalkableAt(to[0], to[1], true);
    const path = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true }).findPath(from[0], from[1], to[0], to[1], grid);
    return path.length > 1 ? path.map(([x, z]) => [x - 9, z - 9] as [number, number]) : [[start[0], start[2]], [destination[0], destination[1]]];
  }, [start, destination]);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const travel = (clock.elapsedTime * .72 + phase) % Math.max(1, route.length - 1);
    const index = Math.floor(travel);
    const blend = travel - index;
    const from = route[index] || route[0];
    const to = route[Math.min(index + 1, route.length - 1)] || from;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, from[0] + (to[0] - from[0]) * blend, 5, delta);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, from[1] + (to[1] - from[1]) * blend, 5, delta);
    ref.current.position.y = start[1] + .035 + Math.abs(Math.sin(clock.elapsedTime * 5)) * .035;
    ref.current.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
    if (limbs.current) limbs.current.rotation.x = Math.sin(clock.elapsedTime * 5) * .08;
  });
  return <group ref={ref} position={start}>
    {/* Compact service robot: armored torso, articulated limbs, face visor and utility pack. */}
    <mesh position={[0,.24,0]} castShadow><capsuleGeometry args={[.115,.24,4,10]}/><Material color={color} metalness={.48} roughness={.3}/></mesh>
    <mesh position={[0,.43,.012]} castShadow><sphereGeometry args={[.125,16,12]}/><Material color="#dce9e7" metalness={.3} roughness={.24}/></mesh>
    <mesh position={[0,.435,.119]}><RoundedBox args={[.145,.055,.025]} radius={.018} smoothness={3}><meshStandardMaterial color="#203b43" metalness={.45} roughness={.2} emissive={color} emissiveIntensity={.45}/></RoundedBox></mesh>
    {[-1,1].map(side=><group key={side} position={[side*.145,.27,0]} rotation={[0,0,side*.12]}>
      <mesh position={[0,-.005,0]} castShadow><capsuleGeometry args={[.035,.14,3,6]}/><Material color="#c5d3cb" metalness={.42} roughness={.35}/></mesh>
      <mesh position={[0,-.105,.012]} castShadow><sphereGeometry args={[.042,8,6]}/><Material color={color} metalness={.25} roughness={.32}/></mesh>
    </group>)}
    <group ref={limbs}>
      {[-1,1].map(side=><group key={side} position={[side*.062,.105,0]}>
        <mesh position={[0,-.055,0]} castShadow><capsuleGeometry args={[.032,.1,3,6]}/><Material color="#9daea9" metalness={.35} roughness={.4}/></mesh>
        <mesh position={[0,-.12,.025]} castShadow><boxGeometry args={[.085,.045,.12]}/><Material color="#354e52" metalness={.3} roughness={.4}/></mesh>
      </group>)}
    </group>
    <mesh position={[0,.28,-.115]} castShadow><RoundedBox args={[.15,.18,.09]} radius={.025} smoothness={3}><meshStandardMaterial color="#354b4d" metalness={.45} roughness={.38}/></RoundedBox></mesh>
    <mesh position={[0,.34,-.17]}><boxGeometry args={[.1,.025,.015]}/><Material color={color} emissive={color} emissiveIntensity={.9}/></mesh>
    <mesh position={[0,-.025,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.14,.19,16]}/><meshBasicMaterial color={color} transparent opacity={.5}/></mesh>
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
    <mesh receiveShadow><boxGeometry args={[length,.035,width]}/><Material color="#c9c09e" roughness={1}/></mesh>
    <mesh position={[0,.02,0]}><boxGeometry args={[length,.012,width*.72]}/><Material color="#e2d8b7" roughness={1}/></mesh>
    {Array.from({length:Math.max(1,Math.floor(length/1.1))},(_,i)=><mesh key={i} position={[-length/2+.55+i*1.1,.03,0]}><boxGeometry args={[.38,.008,.025]}/><Material color="#f5e6c1" roughness={1}/></mesh>)}
  </group>;
}
function ProjectBuilding({position,project,index,onSelect,building}:{position:[number,number,number];project:Project;index:number;onSelect:(id:string)=>void;building:boolean}) {
  const ref=useRef<THREE.Group>(null);
  const tone=project.status==="failed"?"#ff766c":project.tone==="mint"?"#83dbb5":project.tone==="violet"?"#b9a5ff":"#ffdf79";
  useFrame((state,delta)=>{if(ref.current){ref.current.rotation.y += delta*(building ? .18 : .012);if(building)ref.current.position.y=position[1]+.06+Math.sin(state.clock.elapsedTime*4)*.025;}});
  return <group ref={ref} position={position} onClick={(e)=>{e.stopPropagation();onSelect(project.id)}}>
    <mesh position={[0,.06,0]} castShadow receiveShadow><cylinderGeometry args={[.85,.92,.16,8]}/><Material color={building?"#bd8c47":"#8b9278"}/></mesh>
    <mesh position={[0,.15,0]}><ringGeometry args={[.72,.8,8]}/><meshBasicMaterial color={tone} transparent opacity={.8}/></mesh>
    {building?<><mesh position={[0,.72,0]} castShadow><boxGeometry args={[1,1.05,1]}/><meshStandardMaterial color="#e7c982" wireframe transparent opacity={.55}/></mesh><mesh position={[0,1.27,0]}><boxGeometry args={[1.12,.07,1.12]}/><Material color="#d2a85c"/></mesh><Sparkles count={20} scale={1.55} size={2.4} speed={.8} color="#ffdf79"/></>:<><House position={[0,.14,0]} kind={index+1} scale={.82}/><mesh position={[0,1.57,0]}><sphereGeometry args={[.065,12,12]}/><meshBasicMaterial color={tone}/></mesh><Sparkles count={project.status==="active"?7:3} scale={[.8,.3,.8]} position={[0,1.45,0]} size={1.6} speed={.22} color={tone}/></>}
  </group>;
}
function DistrictBuilding({position,kind,label,onSelect}:{position:[number,number,number];kind:number;label:string;onSelect:(id:DistrictId)=>void}) {\n  const id=label==="Builder Hut"?"builder":label==="Knowledge Archive"?"archive":label==="AI Infrastructure"?"infrastructure":"hq";\n  const accent=id==="builder"?"#b9ed91":id==="archive"?"#c5b5ff":id==="infrastructure"?"#91dff1":"#ffdf78";\n  return <group position={position} onClick={(e)=>{e.stopPropagation();onSelect(id as DistrictId);}} onPointerOver={(e)=>{e.stopPropagation();document.body.style.cursor="pointer";}} onPointerOut={()=>{document.body.style.cursor="auto";}}>\n    <mesh position={[0,.055,0]} receiveShadow><cylinderGeometry args={[1.02,1.12,.13,8]}/><Material color="#9b9b77"/></mesh>\n    <mesh position={[0,.13,0]}><ringGeometry args={[.86,.96,8]}/><meshBasicMaterial color={accent} transparent opacity={.9}/></mesh>\n    <House position={[0,.1,0]} kind={kind} scale={.9}/>\n    <mesh position={[0,1.88,.03]}><boxGeometry args={[.92,.23,.07]}/><Material color="#24452f" metalness={.2}/></mesh>\n    <mesh position={[0,1.88,.073]}><boxGeometry args={[.76,.035,.012]}/><Material color={accent} emissive={accent} emissiveIntensity={.8}/></mesh>\n    <Sparkles count={7} position={[0,1.7,0]} scale={[1.15,.5,1.15]} size={1.7} speed={.25} color={accent}/>\n  </group>;\n}\nfunction World({projects,buildingId,onSelect,onDistrictSelect}:{projects:Project[];buildingId:string|null;onSelect:(id:string)=>void;onDistrictSelect:(id:DistrictId)=>void}) {
  const forest=useMemo(()=>Array.from({length:56},(_,i)=>{const a=i*2.399;const r=7.5+(i%4)*.45;return {x:Math.cos(a)*r,z:Math.sin(a)*r,s:.62+(i%5)*.095};}),[]);
  const occupied=projects.map((p,i)=>({p,i,plot:plots[i%plots.length]}));
  return <group>
    <mesh position={[0,-.32,0]} receiveShadow><cylinderGeometry args={[11.9,12.2,.7,12]}/><Material color="#4c7650" roughness={1}/></mesh>
    <mesh position={[0,-.1,0]} receiveShadow><cylinderGeometry args={[11.5,11.8,.22,12]}/><Material color="#83b76a" roughness={1}/></mesh>
    <mesh position={[0,-.015,0]} receiveShadow><boxGeometry args={[17.8,.055,17.8]}/><Material color="#85b766" roughness={1}/></mesh>
    {Array.from({length:24},(_,i)=>{const a=i*2.399,r=2.1+(i%5)*1.05;return <mesh key={i} position={[Math.cos(a)*r,.015,Math.sin(a)*r]} rotation={[-Math.PI/2,0,a]}><circleGeometry args={[.34+(i%3)*.12,7]}/><Material color={i%3===0?"#9bc878":i%3===1?"#91c16f":"#78a95e"} roughness={1}/></mesh>})}
    <Road from={[0,0]} to={[0,-5.9]} width={.62}/>
    <Road from={[0,0]} to={[0,5.8]} width={.62}/>
    <Road from={[0,0]} to={[-5.9,0]} width={.62}/>
    <Road from={[0,0]} to={[5.9,0]} width={.62}/>
    <Road from={[-3.2,-2.3]} to={[0,0]} width={.48}/>
    <Road from={[3.1,-2.5]} to={[0,0]} width={.48}/>
    <Road from={[-3.4,2.4]} to={[0,0]} width={.48}/>
    <Road from={[3.25,2.45]} to={[0,0]} width={.48}/>
    {forest.map((t,i)=><Tree key={i} position={[t.x,-.02,t.z]} scale={t.s} autumn={i%7===0}/>)}
    <HQ onSelect={onDistrictSelect}/>\n    <DistrictBuilding position={[0,0,-6.05]} kind={3} label="Builder Hut" onSelect={onDistrictSelect}/>\n    <DistrictBuilding position={[-6.05,0,0]} kind={2} label="Knowledge Archive" onSelect={onDistrictSelect}/>\n    <DistrictBuilding position={[6.05,0,0]} kind={4} label="AI Infrastructure" onSelect={onDistrictSelect}/>
    {occupied.map(({p,i,plot})=>{const x=typeof p.gridX==="number"?p.gridX:plot[0];const z=typeof p.gridZ==="number"?p.gridZ:plot[1];const building=p.id===buildingId||["under_construction","initializing"].includes(p.status);return <ProjectBuilding key={p.id} position={[x,.02,z]} project={p} index={i} onSelect={onSelect} building={building}/>;})}
    {[[ -5.7,-5.3], [5.65,-5.4],[-5.7,5.3],[5.65,5.4]].map((p,i)=><group key={i} position={[p[0],0,p[1]]}><mesh position={[0,.3,0]} castShadow><cylinderGeometry args={[.12,.16,.6,8]}/><Material color="#b9a16d" metalness={.35}/></mesh><mesh position={[0,.65,0]}><sphereGeometry args={[.13,12,10]}/><Material color="#ffe6a0" emissive="#ffcf62" emissiveIntensity={1.2}/></mesh><pointLight position={[0,.75,0]} color="#ffd887" intensity={.45} distance={2}/></group>)}
    <Agent start={[-1.5,.05,-1.2]} color="#f3c969" phase={0}/>
    <Agent start={[1.7,.05,1.2]} color="#8ce0b0" phase={2.3}/>
    <Agent start={[-1.2,.05,1.6]} color="#a9a1ff" phase={4.4}/>
    <ContactShadows position={[0,-.02,0]} opacity={.22} scale={19} blur={2.2} far={5}/>
  </group>;
}
export default function WorldScene({projects,buildingId,onSelect,onDistrictSelect}:Props) {
  return <Canvas shadows dpr={[1,1.15]} camera={{position:[9,9.5,10.5],fov:38}} gl={{antialias:false,alpha:true,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.setClearColor("#a8d7ec",1);}}>
    <color attach="background" args={["#a8d7ec"]}/><fog attach="fog" args={["#a8d7ec",25,39]}/>
    <ambientLight intensity={1.05}/><hemisphereLight args={["#d9e8ff","#40533d",1.2]}/>
    <directionalLight position={[7,13,5]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={13} shadow-camera-bottom={-13}/>
    <Suspense fallback={null}><Float speed={.25} rotationIntensity={.006} floatIntensity={.012}><World projects={projects} buildingId={buildingId} onSelect={onSelect} onDistrictSelect={onDistrictSelect}/></Float></Suspense>
    <OrbitControls makeDefault enablePan={false} minDistance={7.5} maxDistance={17} minPolarAngle={.55} maxPolarAngle={1.23} target={[0,.35,0]} enableDamping dampingFactor={.075}/>
  </Canvas>;
}
