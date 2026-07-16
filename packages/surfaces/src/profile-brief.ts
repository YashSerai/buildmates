import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION } from "./design-policy";

export type ProfileBriefField = { key: string; label: string; value: unknown; bindingType: "text" | "facts" | "projects" };
export function createProfileGenerationBrief(input:{handle:string;fields:ProfileBriefField[]}) {
  const seen=new Set<string>(); const fields=input.fields.filter((field)=>/^[a-z][a-z0-9_.-]{0,95}$/i.test(field.key)&&!seen.has(field.key)&&(seen.add(field.key),true));
  return { kind:"profile" as const, handle:input.handle, designPolicy:{id:DESIGN_POLICY_ID,version:DESIGN_POLICY_VERSION}, instruction:"Compose a trusted profile SurfaceSpec. Use only the bindings supplied here. Keep product actions outside decorative regions.", allowedBindings:fields.map(({key,label,bindingType})=>({key,label,type:bindingType})), authorizedContent:Object.fromEntries(fields.map(({key,value})=>[key,value])), forbidden:["scripts","forms","remote URLs","permission controls","private or unlisted fields"] };
}
