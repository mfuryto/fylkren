import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base=process.env.FYLKREN_E2E_BASE_URL??'http://localhost:18081'; const cookies=new Map(); let csrfToken;
async function request(path,method,body){const headers={'Content-Type':'application/json'};if(cookies.size)headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');if(csrfToken&&method!=='GET')headers['X-Fylkren-CSRF']=csrfToken;const response=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});for(const value of response.headers.getSetCookie()){const pair=value.split(';',1)[0],i=pair.indexOf('=');if(i>0)cookies.set(pair.slice(0,i),pair.slice(i+1))}const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch{parsed=text}return{status:response.status,body:parsed}}
const suffix=randomBytes(6).toString('hex');
const lower='mnbvcxzlkjhgfdsapoiu'; const upper='MNBVCXZLKJHGFDSAPOIU'; const symbols='!#$%&*+<=>?@^|~!#$%&'; const digits='90715284639071528463';
for(const value of [lower,upper,symbols,digits])assert.ok(value.length>=14);
const username=`composition-${suffix}`;
assert.equal((await request('/api/bootstrap/platform-manager','POST',{username,displayName:'Synthetic Composition Manager',email:`${username}@example.invalid`,password:lower})).status,201);
const csrf=await request('/api/security/antiforgery','GET');assert.equal(csrf.status,200);csrfToken=csrf.body.token;
assert.equal((await request('/api/profile/password','PUT',{currentPassword:lower,newPassword:upper})).status,204);
assert.equal((await request('/api/profile/password','PUT',{currentPassword:upper,newPassword:symbols})).status,204);
const site=await request('/api/sites/','POST',{name:`Composition Site ${suffix}`,overviewDesign:'classic'});assert.equal(site.status,201);
const resetUsername=`composition-reset-${suffix}`;const created=await request(`/api/sites/${site.body.id}/access/local-users`,'POST',{displayName:'Synthetic Composition Reset',email:`${resetUsername}@example.invalid`,username:resetUsername,organizationUnitId:null});assert.equal(created.status,201);
assert.equal((await request('/api/password-reset/complete','POST',{resetCode:created.body.resetCode,newPassword:digits})).status,204);
process.stdout.write(`${JSON.stringify({passwordCompositionRuntime:'passed',acceptedCompositions:['lowercase-only','uppercase-only','symbols-only','digits-only'],testedFlows:['bootstrap','change','reset']})}\n`);
