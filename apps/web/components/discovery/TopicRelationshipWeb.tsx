"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BuildGraphEdge, BuildGraphRelationship, BuildGraphTopic } from "../../src/discovery/service";
import { CATEGORY_COLORS, createTopicGraphModel, strongestNeighbors } from "./build-graph-model";
import styles from "./BuildGraph.module.css";

type Position = { x:number;y:number;z:number };
type Hover = { topic:BuildGraphTopic;x:number;y:number } | null;

export function TopicRelationshipWeb({topics,edges,relationships,searchTarget,signedIn}:{topics:BuildGraphTopic[];edges:BuildGraphEdge[];relationships:BuildGraphRelationship[];searchTarget:string|null;signedIn:boolean}) {
  const model=useMemo(()=>createTopicGraphModel(topics,relationships),[topics,relationships]);
  const [minUsers,setMinUsers]=useState(1),[minShared,setMinShared]=useState(1),[category,setCategory]=useState("all"),[strength,setStrength]=useState("all");
  const [selectedId,setSelectedId]=useState<string|null>(null),[hover,setHover]=useState<Hover>(null);
  const mountRef=useRef<HTMLDivElement>(null), selectedRef=useRef<string|null>(null), focusRef=useRef<(id:string)=>void>(()=>{});
  selectedRef.current=selectedId;
  const categories=model.roots;
  const filteredTopics=useMemo(()=>topics.filter(topic=>topic.builderCount>=minUsers&&(category==="all"||model.rootFor(topic.id)===category)),[topics,minUsers,category,model]);
  const topicIds=useMemo(()=>new Set(filteredTopics.map(topic=>topic.id)),[filteredTopics]);
  const maxShared=Math.max(1,...edges.map(edge=>edge.builderCount));
  const filteredEdges=useMemo(()=>edges.filter(edge=>topicIds.has(edge.sourceId)&&topicIds.has(edge.targetId)&&edge.builderCount>=minShared&&(strength==="all"||strength==="strong"&&edge.builderCount>=Math.max(2,Math.ceil(maxShared*.6))||strength==="core"&&edge.builderCount>=maxShared)),[edges,topicIds,minShared,strength,maxShared]);
  const selected=selectedId?model.topicById.get(selectedId)??null:null;
  const related=selected?strongestNeighbors(selected.id,filteredEdges,6).map(item=>({...item,topic:model.topicById.get(item.id)!})).filter(item=>item.topic):[];

  useEffect(()=>{if(searchTarget&&topicIds.has(searchTarget)){setSelectedId(searchTarget);queueMicrotask(()=>focusRef.current(searchTarget))}},[searchTarget,topicIds]);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!filteredTopics.length)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#121a14");scene.fog=new THREE.Fog("#121a14",18,39);
    const camera=new THREE.PerspectiveCamera(44,1,.1,100);camera.position.set(0,2,24);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=9;controls.maxDistance=38;controls.enablePan=true;
    scene.add(new THREE.AmbientLight(0xf3f0e7,1.45));const key=new THREE.DirectionalLight(0xe7f1dd,2.1);key.position.set(7,9,12);scene.add(key);const rim=new THREE.DirectionalLight(0xc46f45,1.1);rim.position.set(-8,-3,-6);scene.add(rim);
    const positions=layoutGraph(filteredTopics,filteredEdges);const meshes=new Map<string,THREE.Mesh>();const edgeObjects:{edge:BuildGraphEdge;object:THREE.Mesh}[]=[];
    const grid=new THREE.GridHelper(34,18,0x3d5543,0x263529);grid.position.y=-8;scene.add(grid);
    for(const edge of filteredEdges){const a=positions.get(edge.sourceId),b=positions.get(edge.targetId);if(!a||!b)continue;const geometry=new THREE.CylinderGeometry(.025+edge.strength*.12,.025+edge.strength*.12,distance(a,b),8);const material=new THREE.MeshStandardMaterial({color:0x8da181,transparent:true,opacity:.18+edge.strength*.52,roughness:.75});const line=new THREE.Mesh(geometry,material);placeCylinder(line,a,b);line.userData={kind:"edge",edge};scene.add(line);edgeObjects.push({edge,object:line});}
    const maxUsers=Math.max(1,...filteredTopics.map(topic=>topic.builderCount));
    for(const topic of filteredTopics){const position=positions.get(topic.id)!;const radius=.42+Math.sqrt(topic.builderCount/maxUsers)*.9;const root=model.rootFor(topic.id);const color=CATEGORY_COLORS[Math.max(0,categories.findIndex(item=>item.id===root))%CATEGORY_COLORS.length];const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,30,22),new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.04,emissive:new THREE.Color(color).multiplyScalar(.08)}));mesh.position.set(position.x,position.y,position.z);mesh.userData={kind:"topic",id:topic.id};scene.add(mesh);meshes.set(topic.id,mesh);const label=makeLabel(topic.label,radius);label.position.set(position.x,position.y-radius-0.35,position.z);scene.add(label);mesh.userData.label=label;}
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const applySelection=(id:string|null)=>{const connected=new Set(id?[id,...filteredEdges.filter(edge=>edge.sourceId===id||edge.targetId===id).flatMap(edge=>[edge.sourceId,edge.targetId])]:[]);for(const [topicId,mesh] of meshes){const material=mesh.material as THREE.MeshStandardMaterial;const active=!id||connected.has(topicId);material.opacity=active?1:.13;material.transparent=!active;mesh.scale.setScalar(topicId===id?1.28:1);const label=mesh.userData.label as THREE.Sprite;label.material.opacity=active?1:.13;}for(const {edge,object} of edgeObjects){const direct=!id||edge.sourceId===id||edge.targetId===id;(object.material as THREE.MeshStandardMaterial).opacity=direct?.24+edge.strength*.62:.035;}};
    const focus=(id:string)=>{const mesh=meshes.get(id);if(!mesh)return;const target=mesh.position.clone();controls.target.copy(target);const direction=camera.position.clone().sub(target).normalize();camera.position.copy(target.clone().add(direction.multiplyScalar(9)));controls.update();applySelection(id)};focusRef.current=focus;
    const locate=(event:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects([...meshes.values()],false)[0]?.object as THREE.Mesh|undefined};
    const move=(event:PointerEvent)=>{const hit=locate(event);renderer.domElement.style.cursor=hit?"pointer":"grab";if(hit){const topic=model.topicById.get(hit.userData.id);if(topic)setHover({topic,x:event.clientX,y:event.clientY})}else setHover(null)};
    const click=(event:PointerEvent)=>{const hit=locate(event);const id=hit?.userData.id??null;setSelectedId(id);applySelection(id);if(id)focus(id)};
    renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("click",click);
    const resize=()=>{const width=mount.clientWidth,height=mount.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    let frame=0;const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)};animate();applySelection(selectedRef.current);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("click",click);controls.dispose();renderer.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const material=object.material as THREE.Material|THREE.Material[];(Array.isArray(material)?material:[material]).forEach(item=>item.dispose())}if(object instanceof THREE.Sprite){object.material.map?.dispose();object.material.dispose()}});mount.removeChild(renderer.domElement)};
  },[filteredTopics,filteredEdges,model,categories]);

  return <section className={styles.webShell} aria-label="Three-dimensional topic relationship web">
    <div className={styles.filters}>
      <label>Minimum builders <input type="range" min="1" max={Math.max(2,...topics.map(t=>t.builderCount))} value={minUsers} onChange={event=>setMinUsers(Number(event.target.value))}/><output>{minUsers}</output></label>
      <label>Minimum shared <input type="range" min="1" max={maxShared} value={Math.min(minShared,maxShared)} onChange={event=>setMinShared(Number(event.target.value))}/><output>{Math.min(minShared,maxShared)}</output></label>
      <label>Category <select value={category} onChange={event=>setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(topic=><option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
      <label>Relationship <select value={strength} onChange={event=>setStrength(event.target.value)}><option value="all">All visible</option><option value="strong">Strong</option><option value="core">Strongest only</option></select></label>
    </div>
    <div className={styles.webLayout}>
      <div className={styles.canvasWrap}>{filteredTopics.length?<div ref={mountRef} className={styles.webCanvas}/>:<div className={styles.emptyLevel}><h3>No topics match these filters.</h3><p>Lower a threshold or return to all categories.</p><button type="button" onClick={()=>{setMinUsers(1);setMinShared(1);setCategory("all");setStrength("all")}}>Reset filters</button></div>}<div className={styles.canvasHelp}><span>Drag to rotate</span><span>Scroll to zoom</span><span>Right-drag to pan</span></div>{hover?<div className={styles.tooltip} style={{left:Math.min(hover.x+14,window.innerWidth-250),top:Math.min(hover.y+14,window.innerHeight-170)}}><strong>{hover.topic.label}</strong><p>{hover.topic.builderCount} {hover.topic.builderCount===1?"builder":"builders"}</p></div>:null}</div>
      <aside className={styles.inspector} aria-live="polite">{selected?<><p className={styles.kicker}>Focused topic</p><h3>{selected.label}</h3><div className={styles.inspectorStat}><strong>{selected.builderCount}</strong><span>builders</span></div><dl><div><dt>Category</dt><dd>{model.topicById.get(model.rootFor(selected.id))?.label??"Other"}</dd></div><div><dt>Projects</dt><dd>{selected.projectCount}</dd></div></dl><h4>Strongest overlaps</h4>{related.length?<ol>{related.map(item=><li key={item.id}><span>{item.topic.label}</span><strong>{item.shared} shared</strong></li>)}</ol>:<p className={styles.muted}>No relationships pass the current filters.</p>}<Link className={styles.matchAction} href={signedIn?"/matches":"/onboarding"}>{signedIn?"Find relevant builders":"Join Buildmates"}</Link><p className={styles.privacyCopy}>The graph stays anonymous. Buildmates uses your approved profile to suggest people privately.</p><button className={styles.clearFocus} type="button" onClick={()=>setSelectedId(null)}>Show complete graph</button></>:<><p className={styles.kicker}>Relationship view</p><h3>Choose a topic.</h3><p className={styles.muted}>Its strongest overlaps will appear here. Unrelated topics fade so the shape of the connection is easy to read.</p><div className={styles.inspectorLegend}><span><i className={styles.legendNode}/>Node size = builders</span><span><i className={styles.legendLine}/>Line width = shared builders</span></div></>}</aside>
    </div>
  </section>;
}

function layoutGraph(topics:BuildGraphTopic[],edges:BuildGraphEdge[]){const positions=new Map<string,Position>();const sorted=[...topics].sort((a,b)=>b.builderCount-a.builderCount||a.id.localeCompare(b.id));sorted.forEach((topic,index)=>{const y=1-(index/(Math.max(1,sorted.length-1)))*2;const radius=Math.sqrt(Math.max(0,1-y*y));const angle=index*Math.PI*(3-Math.sqrt(5));positions.set(topic.id,{x:radius*Math.cos(angle)*8,y:y*7,z:radius*Math.sin(angle)*8})});for(let iteration=0;iteration<90;iteration++){const forces=new Map(sorted.map(topic=>[topic.id,{x:0,y:0,z:0}]));for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){const a=positions.get(sorted[i].id)!,b=positions.get(sorted[j].id)!;let dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;const d2=Math.max(.35,dx*dx+dy*dy+dz*dz),factor=.095/d2;forces.get(sorted[i].id)!.x+=dx*factor;forces.get(sorted[i].id)!.y+=dy*factor;forces.get(sorted[i].id)!.z+=dz*factor;forces.get(sorted[j].id)!.x-=dx*factor;forces.get(sorted[j].id)!.y-=dy*factor;forces.get(sorted[j].id)!.z-=dz*factor}for(const edge of edges){const a=positions.get(edge.sourceId),b=positions.get(edge.targetId);if(!a||!b)continue;const pull=.0025+.006*edge.strength;for(const axis of ["x","y","z"] as const){const delta=b[axis]-a[axis];forces.get(edge.sourceId)![axis]+=delta*pull;forces.get(edge.targetId)![axis]-=delta*pull}}for(const topic of sorted){const p=positions.get(topic.id)!,f=forces.get(topic.id)!;p.x=(p.x+f.x)*.997;p.y=(p.y+f.y)*.997;p.z=(p.z+f.z)*.997}}return positions}
function distance(a:Position,b:Position){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}
function placeCylinder(mesh:THREE.Mesh,a:Position,b:Position){const start=new THREE.Vector3(a.x,a.y,a.z),end=new THREE.Vector3(b.x,b.y,b.z);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize())}
function makeLabel(text:string,radius:number){const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const context=canvas.getContext("2d")!;context.font="600 34px Segoe UI";context.textAlign="center";context.fillStyle="#f3f0e7";context.fillText(text.length>24?text.slice(0,23)+"…":text,256,55);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(Math.max(2.2,Math.min(5,text.length*.16)),.9,1);sprite.userData.radius=radius;return sprite}
