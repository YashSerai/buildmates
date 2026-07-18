import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { getProjectBySlug } from "../../../src/profile-projects/service";
import { ProjectControls } from "./ProjectControls";
import { ShareButton } from "../../../components/discovery/ShareButton";
import {
  ProductFooter,
  ProductHeader,
} from "../../../components/discovery/ProductHeader";
import styles from "../../profile-projects.module.css";

async function load(slug:string){const[viewer,{DB}]=await Promise.all([getCurrentUser(),getPlatformBindings()]);const project=await getProjectBySlug(DB,slug,viewer?.id??null).catch(()=>null);if(!project)return null;const role=viewer?await DB.prepare("SELECT role FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL").bind(project.id,viewer.id).first<{role:string}>():null;return{...project,viewerId:viewer?.id??null,canEdit:project.ownerUserId===viewer?.id||role?.role==="editor"}}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const project=await load(slug);if(!project)return{title:"Project not found",robots:{index:false,follow:false}};const index=project.audience==="public"&&project.indexable&&project.status==="active";const title=`${project.title} on Buildmates`;const description=String(project.summary);return{title,description,robots:{index,follow:index},alternates:{canonical:`/projects/${project.slug}`},openGraph:{title,description,type:"article"}}}
export default async function ProjectPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const project=await load(slug);if(!project)notFound();return <><ProductHeader signedIn={Boolean(project.viewerId)}/><main className={styles.page}>
  <div className={styles.profileActions}><Link className={styles.back} href={`/builders/${project.handle}`}>Back to {String(project.ownerDisplayName)}</Link><ShareButton label="Share project" title={`${project.title} on Buildmates`} /></div>
  <header className={styles.projectHeader}><p className={styles.projectState}><span>{projectLabel(String(project.stage))}</span><span>{projectLabel(String(project.status))}</span></p><h1>{String(project.title)}</h1><p className={styles.lede}>{String(project.summary)}</p></header>
  {project.links.length>0&&<section><h2>Links</h2><ul className={styles.links}>{project.links.map((link,index)=><li key={index}><a href={String(link.url)} rel="noopener noreferrer">{String(link.label)}</a></li>)}</ul></section>}
  <section><h2>Build context</h2>{project.taxonomy.length?<ul className={styles.tags}>{project.taxonomy.map((item,index)=><li key={index}>{String(item.label ?? item.id)}</li>)}</ul>:<p className={styles.empty}>No topics, tools, or domains have been added.</p>}</section>
  <section><h2>Updates</h2>{project.updates.length?<ol>{project.updates.map(update=><li key={update.id}><p>{update.body}</p><small>{new Date(update.createdAt).toLocaleDateString()}</small></li>)}</ol>:<p className={styles.empty}>No visible updates yet.</p>}</section>
  <ProjectControls slug={project.slug} status={project.status} isOwner={project.ownerUserId===project.viewerId} canEdit={project.canEdit}/>
</main><ProductFooter/></>}

function projectLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
