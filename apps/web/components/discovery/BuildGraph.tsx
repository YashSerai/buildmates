"use client";

import { useMemo, useState } from "react";
import type { BuildGraphEdge, BuildGraphRelationship, BuildGraphTopic } from "../../src/discovery/service";
import styles from "./BuildGraph.module.css";

type Position = { id:string; x:number; y:number; center:boolean };

export function BuildGraph({ topics, edges, relationships }:{ topics:BuildGraphTopic[]; edges:BuildGraphEdge[]; relationships:BuildGraphRelationship[] }) {
  const [focusId,setFocusId]=useState<string|null>(null);
  const topicById=useMemo(()=>new Map(topics.map(topic=>[topic.id,topic])),[topics]);
  const visible=useMemo(()=>selectVisible(topics,edges,relationships,focusId),[topics,edges,relationships,focusId]);
  const positions=useMemo(()=>placeNodes(visible,focusId),[visible,focusId]);
  const positionById=new Map(positions.map(position=>[position.id,position]));
  const visibleEdges=edges.filter(edge=>positionById.has(edge.sourceId)&&positionById.has(edge.targetId));
  if(!topics.length)return <div className={styles.empty}><div><h2>The graph starts with the first topic.</h2><p>Approved project topics will appear here after setup or a Work Pulse.</p></div></div>;
  return <div className={styles.shell}>
    <div className={styles.toolbar}>
      <p>{focusId ? `Inside ${topicById.get(focusId)?.label ?? "this topic"}: related work and the strongest overlaps.` : "Each bubble is an anonymous topic. Lines grow stronger when more builders work across both topics."}</p>
      {focusId?<button className={styles.back} type="button" onClick={()=>setFocusId(null)}>Back to all topics</button>:null}
    </div>
    <div className={styles.field}>
      <svg className={styles.links} viewBox="0 0 1000 620" aria-hidden="true" preserveAspectRatio="none">{visibleEdges.map(edge=>{const a=positionById.get(edge.sourceId)!,b=positionById.get(edge.targetId)!;return <line className={styles.link} key={`${edge.sourceId}:${edge.targetId}`} x1={a.x*10} y1={a.y*6.2} x2={b.x*10} y2={b.y*6.2} strokeWidth={1.5+edge.strength*7}/>})}</svg>
      {positions.map(position=>{const topic=topicById.get(position.id)!;const scale=topic.builderCount>=10?styles.large:topic.builderCount>=4?styles.medium:styles.small;return <button type="button" key={topic.id} className={`${styles.node} ${scale} ${position.center?styles.center:""}`} style={{left:`${position.x}%`,top:`${position.y}%`}} onClick={()=>setFocusId(topic.id)} aria-label={`${topic.label}, ${topic.builderCount} builders. Explore related topics.`}><strong>{topic.label}</strong><span>{topic.builderCount} {topic.builderCount===1?"builder":"builders"}</span></button>})}
    </div>
  </div>;
}

function selectVisible(topics:BuildGraphTopic[],edges:BuildGraphEdge[],relationships:BuildGraphRelationship[],focusId:string|null){
  if(!focusId){const childIds=new Set(relationships.map(relation=>relation.childId));const roots=topics.filter(topic=>!childIds.has(topic.id));return (roots.length>=3?roots:topics).slice(0,14)}
  const children=relationships.filter(relation=>relation.parentId===focusId).map(relation=>relation.childId);
  const neighbors=edges.filter(edge=>edge.sourceId===focusId||edge.targetId===focusId).sort((a,b)=>b.builderCount-a.builderCount||b.contributionCount-a.contributionCount).map(edge=>edge.sourceId===focusId?edge.targetId:edge.sourceId);
  const ids=[focusId,...new Set([...children,...neighbors])];return ids.map(id=>topics.find(topic=>topic.id===id)).filter((topic):topic is BuildGraphTopic=>Boolean(topic)).slice(0,13);
}
function placeNodes(topics:BuildGraphTopic[],focusId:string|null):Position[]{
  if(!topics.length)return[];const centerId=focusId&&topics.some(topic=>topic.id===focusId)?focusId:topics[0].id;const rest=topics.filter(topic=>topic.id!==centerId);const placed:Position[]=[{id:centerId,x:50,y:50,center:true}];rest.forEach((topic,index)=>{const angle=-Math.PI/2+(index/rest.length)*Math.PI*2;const ring=index%2===0?1:.82;placed.push({id:topic.id,x:50+Math.cos(angle)*39*ring,y:50+Math.sin(angle)*38*ring,center:false})});return placed;
}
