'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Shared suppliers, materials and supplier prices are read-only for clients',()=>{
 const sql=read('supabase/migrations/20261115_restrict_shared_catalog_writes.sql');
 for(const table of ['suppliers','materials','supplier_prices']){
  assert.match(sql,new RegExp('drop policy if exists "members access '+table.replace(/_/g,' ')+'"'));
  assert.match(sql,new RegExp('create policy "members read '+table.replace(/_/g,' ')+'"'));
  for(const kind of ['insert','update','delete']){
   assert.match(sql,new RegExp('create policy "members '+kind+' own '+table.replace(/_/g,' ')+'"'));
  }
 }
 const ownPolicies=sql.split(/create policy "members (?:insert|update|delete) own /).slice(1);
 for(const policy of ownPolicies){
  assert.match(policy,/organization_id is not null|m\.organization_id is not null/);
  assert.match(policy,/public\.user_in_org/);
 }
});

test('Project storage validates snapshot, organization and optimistic version before writing',()=>{
 const cloud=read('supabase-cloud.js');
 assert.match(cloud,/core\.normalize\(state,DEFAULT_STATE,DATA\)/);
 assert.match(cloud,/\.eq\('organization_id',organizationId\)/);
 assert.match(cloud,/\.eq\('version',knownVersion\)/);
 assert.match(cloud,/remote\.project_state\?\.projectMeta\?\.id!==snapshot\.projectMeta\.id/);
});
test('BOM remote catalog is loaded only for verified admin membership',()=>{
 const bridge=read('supabase-3d-bom-bridge.js');
 const auth=bridge.indexOf('client.auth.getUser()');
 const role=bridge.indexOf(".in('role',['owner','admin'])");
 const bom=bridge.indexOf("client.from('component_reference_bom')");
 assert.ok(auth>=0&&role>auth&&bom>role);
 assert.match(bridge,/\.eq\('organization_id',org\)/);
});
test('Six-step wizard restores ability to move independently of expensive wall readiness',()=>{
 const wizard=read('wizard-interior-step.js');
 assert.match(wizard,/goStep=function\(step\)/);
 assert.match(wizard,/state\.step=clamp\(Number\(step\)\|\|1,1,6\)/);
 assert.match(wizard,/if\(state\.step===4\)ensureWallFeatureChain\(\)/);
 assert.match(wizard,/quote\.dataset\.step='6'/);
});
