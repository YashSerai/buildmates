"use client";

import { hierarchy, pack } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { BuildGraphRelationship, BuildGraphTopic } from "../../src/discovery/service";
import { CATEGORY_COLORS, createTopicGraphModel } from "./build-graph-model";
import styles from "./BuildGraph.module.css";

type Datum = { id: string; value: number };
type Tip = { topic: BuildGraphTopic; x: number; y: number } | null;

export function TopicBubbleMap({ topics, relationships, totalBuilders, searchTarget }:{ topics:BuildGraphTopic[]; relationships:BuildGraphRelationship[]; totalBuilders:number; searchTarget:string|null }) {
  const model = useMemo(() => createTopicGraphModel(topics, relationships), [topics, relationships]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x:number;y:number;ox:number;oy:number } | null>(null);

  useEffect(()=>{if(searchTarget&&model.topicById.has(searchTarget)){setFocusId(model.parentById.get(searchTarget)??null);setZoom(1);setPan({x:0,y:0})}},[searchTarget,model]);
  const effectiveFocus = focusId;
  const visibleTopics = useMemo(() => {
    const ids = effectiveFocus ? model.childrenById.get(effectiveFocus) ?? [] : model.roots.map((topic) => topic.id);
    return ids.map((id) => model.topicById.get(id)).filter((topic): topic is BuildGraphTopic => Boolean(topic));
  }, [effectiveFocus, model]);
  const nodes = useMemo(() => {
    const root = hierarchy<{ children?:Datum[]; id?:string; value?:number }>({ children: visibleTopics.map((topic) => ({ id:topic.id, value:Math.max(1, topic.builderCount) })) }).sum((d) => d.value ?? 0);
    return pack<typeof root.data>().size([1000, 660]).padding(9)(root).leaves();
  }, [visibleTopics]);
  const breadcrumb = effectiveFocus ? model.pathTo(effectiveFocus) : [];
  const currentTopic = effectiveFocus ? model.topicById.get(effectiveFocus) : null;
  const hasChildren = visibleTopics.length > 0;

  const openTopic = (id:string) => {
    if ((model.childrenById.get(id) ?? []).length) {
      setFocusId(id); setZoom(1); setPan({x:0,y:0}); setTip(null);
    } else {
      const topic = model.topicById.get(id);
      if (topic) setTip({topic,x:500,y:330});
    }
  };
  const wheel = (event:WheelEvent<SVGSVGElement>) => { event.preventDefault(); setZoom((value)=>Math.min(2.5,Math.max(.72,value*(event.deltaY>0?.9:1.1)))); };
  const pointerDown = (event:PointerEvent<SVGSVGElement>) => { if (event.button!==0)return; drag.current={x:event.clientX,y:event.clientY,ox:pan.x,oy:pan.y}; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event:PointerEvent<SVGSVGElement>) => { if(!drag.current)return; setPan({x:drag.current.ox+(event.clientX-drag.current.x)/zoom,y:drag.current.oy+(event.clientY-drag.current.y)/zoom}); };
  const pointerUp = () => { drag.current=null; };

  return <section className={styles.visualStage} aria-label="Hierarchical topic bubble map">
    <div className={styles.mapBar}>
      <nav className={styles.breadcrumbs} aria-label="Topic path">
        <button type="button" onClick={()=>{setFocusId(null);setZoom(1);setPan({x:0,y:0})}} aria-current={!effectiveFocus?"page":undefined}>All topics</button>
        {breadcrumb.map((topic)=><span key={topic.id}><i aria-hidden="true">/</i><button type="button" onClick={()=>setFocusId(topic.id)} aria-current={topic.id===effectiveFocus?"page":undefined}>{topic.label}</button></span>)}
      </nav>
      <div className={styles.zoomControls} aria-label="Map zoom controls">
        <button type="button" onClick={()=>setZoom((value)=>Math.min(2.5,value*1.2))} aria-label="Zoom in">+</button>
        <button type="button" onClick={()=>setZoom((value)=>Math.max(.72,value/1.2))} aria-label="Zoom out">−</button>
        <button type="button" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}>Reset</button>
      </div>
    </div>
    <div className={styles.bubbleViewport}>
      {hasChildren ? <svg className={styles.bubbleSvg} viewBox="0 0 1000 660" role="img" aria-label={`${currentTopic?.label ?? "All topics"}: ${visibleTopics.length} topics`} onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
        <defs><radialGradient id="bubble-light" cx="35%" cy="28%"><stop offset="0" stopColor="#ffffff" stopOpacity=".16"/><stop offset="1" stopColor="#000000" stopOpacity=".08"/></radialGradient></defs>
        <g className={styles.packGroup} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <circle className={styles.outerCircle} cx="500" cy="330" r="323" />
          {nodes.map((node,index)=>{const topic=model.topicById.get(node.data.id!)!;const highlight=searchTarget===topic.id;const canLabel=node.r>44;const hasNext=(model.childrenById.get(topic.id)??[]).length>0;const fill=CATEGORY_COLORS[index%CATEGORY_COLORS.length];const lines=wrapLabel(topic.label,node.r);const labelSize=Math.max(13,Math.min(22,node.r/4.8));const labelStart=lines.length===2?-14:-4;return <g key={topic.id} className={`${styles.packNode} ${highlight?styles.searchHit:""}`} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0} aria-label={`${topic.label}, ${topic.builderCount} builders${hasNext?", explore subtopics":""}`} onClick={(event)=>{event.stopPropagation();openTopic(topic.id)}} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openTopic(topic.id)}}} onPointerEnter={(event)=>setTip({topic,x:event.clientX,y:event.clientY})} onPointerMove={(event)=>setTip({topic,x:event.clientX,y:event.clientY})} onPointerLeave={()=>setTip(null)}>
            <circle r={node.r} fill={fill}/><circle r={node.r} fill="url(#bubble-light)"/>
            {canLabel?<><text className={styles.packLabel} textAnchor="middle" style={{fontSize:labelSize}}>{lines.map((line,lineIndex)=><tspan key={line} x="0" y={labelStart+lineIndex*(labelSize+2)}>{line}</tspan>)}</text><text className={styles.packCount} textAnchor="middle" y={labelStart+lines.length*(labelSize+2)+13}>{topic.builderCount} {topic.builderCount===1?"builder":"builders"}</text>{hasNext&&node.r>72?<text className={styles.packHint} textAnchor="middle" y={labelStart+lines.length*(labelSize+2)+32}>Explore</text>:null}</>:null}
          </g>})}
        </g>
      </svg> : <div className={styles.emptyLevel}><span aria-hidden="true">○</span><h3>No deeper topics yet.</h3><p>{currentTopic?.label ?? "This topic"} is currently the most specific level in the graph.</p><button type="button" onClick={()=>setFocusId(model.parentById.get(effectiveFocus!)??null)}>Go back one level</button></div>}
      {tip?<TopicTooltip tip={tip} totalBuilders={totalBuilders} parent={model.parentById.get(tip.topic.id)?model.topicById.get(model.parentById.get(tip.topic.id)!)?.label:null}/>:null}
    </div>
    <div className={styles.legend}><span><i className={styles.legendBubble}/>Each circle is a topic</span><span><i className={styles.legendScale}/>More area means more builders</span><span>Click a circle to explore its subtopics</span></div>
  </section>;
}

function TopicTooltip({tip,totalBuilders,parent}:{tip:Exclude<Tip,null>;totalBuilders:number;parent:string|null|undefined}) { const percentage=totalBuilders?Math.round((tip.topic.builderCount/totalBuilders)*100):0; return <div className={styles.tooltip} style={{left:Math.min(tip.x+14,window.innerWidth-250),top:Math.min(tip.y+14,window.innerHeight-170)}} role="status"><strong>{tip.topic.label}</strong><dl><div><dt>Builders</dt><dd>{tip.topic.builderCount}</dd></div><div><dt>Community</dt><dd>{percentage}%</dd></div><div><dt>Within</dt><dd>{parent??"All topics"}</dd></div></dl></div> }
function wrapLabel(label:string,radius:number){const max=Math.max(8,Math.floor(radius/6.2));if(label.length<=max)return[label];const words=label.split(/\s+/),lines:string[]=[];let current="";for(const word of words){const next=current?`${current} ${word}`:word;if(next.length<=max||!current)current=next;else{lines.push(current);current=word}}if(current)lines.push(current);if(lines.length<=2)return lines;return[lines[0],`${lines.slice(1).join(" ").slice(0,max-1)}…`]}
