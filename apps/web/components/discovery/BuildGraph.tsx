"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { BuildGraphEdge, BuildGraphRelationship, BuildGraphTopic } from "../../src/discovery/service";
import { TopicBubbleMap } from "./TopicBubbleMap";
import styles from "./BuildGraph.module.css";

const TopicRelationshipWeb = dynamic(() => import("./TopicRelationshipWeb").then((module) => module.TopicRelationshipWeb), { ssr:false, loading:()=> <div className={styles.loading}><span/><p>Drawing the relationship web…</p></div> });

export function BuildGraph({topics,edges,relationships,totalBuilders}:{topics:BuildGraphTopic[];edges:BuildGraphEdge[];relationships:BuildGraphRelationship[];totalBuilders:number}) {
  const [view,setView]=useState<"topics"|"relationships">("topics");
  const [query,setQuery]=useState("");
  const [searchTarget,setSearchTarget]=useState<string|null>(null);
  const suggestions=useMemo(()=>searchTarget||query.trim().length<2?[]:topics.filter(topic=>topic.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0,7),[query,topics,searchTarget]);
  if(!topics.length)return <div className={styles.empty}><div><span aria-hidden="true">○</span><h2>The graph starts with the first topic.</h2><p>Approved project topics will appear here after setup or a Work Pulse.</p></div></div>;
  const choose=(topic:BuildGraphTopic)=>{setQuery(topic.label);setSearchTarget(topic.id)};
  return <div className={styles.shell}>
    <header className={styles.workspaceHeader}>
      <div><p className={styles.eyebrow}>{view==="topics"?"Living atlas":"Relationship web"}</p><h2>{view==="topics"?"Explore the work inside the network.":"Trace where builders’ interests overlap."}</h2><p>Explore the ideas, tools, and problems builders across Buildmates are working through right now. {view==="topics"?"Move from broad fields into specific topics.":"Stronger lines show where more builders work across the same topics."}</p></div>
      <div className={styles.viewSwitch} role="group" aria-label="Choose visualization"><button type="button" aria-pressed={view==="topics"} onClick={()=>setView("topics")}><span>01</span>Topic atlas</button><button type="button" aria-pressed={view==="relationships"} onClick={()=>setView("relationships")}><span>02</span>Relationship web</button></div>
    </header>
    <div className={styles.searchRow}>
      <div className={styles.searchBox}><label htmlFor="topic-search">Find a topic</label><div><input id="topic-search" type="search" value={query} onChange={event=>{setQuery(event.target.value);setSearchTarget(null)}} placeholder="Try AI agents, design, or payments" autoComplete="off"/><button type="button" onClick={()=>{setQuery("");setSearchTarget(null)}} disabled={!query}>Clear</button></div>{suggestions.length?<ul>{suggestions.map(topic=><li key={topic.id}><button type="button" onClick={()=>choose(topic)}><strong>{topic.label}</strong><span>{topic.builderCount} {topic.builderCount===1?"builder":"builders"}</span></button></li>)}</ul>:query.length>=2&&!searchTarget?<p className={styles.noResult}>No matching topic in the current graph.</p>:null}</div>
      <dl className={styles.graphFacts}><div><dt>Builders mapped</dt><dd>{totalBuilders}</dd></div><div><dt>Topics</dt><dd>{topics.length}</dd></div><div><dt>Relationships</dt><dd>{edges.length}</dd></div></dl>
    </div>
    {view==="topics"?<TopicBubbleMap topics={topics} relationships={relationships} totalBuilders={totalBuilders} searchTarget={searchTarget}/>:<TopicRelationshipWeb topics={topics} edges={edges} relationships={relationships} searchTarget={searchTarget}/>}
  </div>;
}
