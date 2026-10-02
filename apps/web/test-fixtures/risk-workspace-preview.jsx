import { createRoot } from "react-dom/client";
import { LocalizationProvider } from "../src/localization/LocalizationProvider";
import { TaskRiskDialog } from "../src/tasks/TaskRiskDialog";
import { riskLevel } from "../src/tasks/riskModels";
import "@fylkren/ui";
const owner = "synthetic-reader";
const risk = (id, title, probability, impact, residualProbability, residualImpact) => ({id,current:{version:1,title,description:"Synthetic operational risk for visual verification.",probability,impact,score:probability*impact,level:riskLevel(probability,impact),ownerPersonId:owner,ownerNameSnapshot:"Synthetic risk owner",status:"mitigating",dueDate:"2026-12-31",residualProbability,residualImpact,residualScore:residualProbability*residualImpact,residualLevel:riskLevel(residualProbability,residualImpact)},mitigations:[{id:`action-${id}`,version:1,action:"Verify existing work before allocating new resources",ownerPersonId:owner,ownerNameSnapshot:"Synthetic risk owner",status:"planned",dueDate:"2026-12-31"}]});
let risks = [risk("two","Capacity shortage",4,4,2,2),risk("one","Duplicate work",5,4,2,1)];
window.fetch = async (path, init={}) => {
 if (path === "/api/security/antiforgery") return Response.json({token:"synthetic"});
 const body = init.body ? JSON.parse(init.body) : {};
 if (init.method === "PUT" && String(path).startsWith("/api/risks/")) {
  const value=risks.find(r=>path===`/api/risks/${r.id}`);
  if(value) value.current={...value.current,...body,version:value.current.version+1,score:body.probability*body.impact,level:riskLevel(body.probability,body.impact),residualScore:body.residualProbability*body.residualImpact,residualLevel:riskLevel(body.residualProbability,body.residualImpact)};
  return Response.json({id:value?.id});
 }
 if (init.method === "POST") return Response.json({id:"synthetic-new-risk"},{status:201});
 return Response.json(risks);
};
createRoot(document.getElementById("root")).render(<LocalizationProvider language={new URLSearchParams(location.search).get("language") ?? "nb-NO"}><TaskRiskDialog siteId="site" item={{id:"task",title:"Synthetic risk assessment"}} personId={owner} editable busy={false} onClose={()=>{}} onError={message=>{window.testError=message;}} /></LocalizationProvider>);
