import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createServer} from 'vite';
import {requestResearchSession, researchAssignmentToken} from '../src/research/services/researchAssignment.ts';
import {createResearchSync} from '../src/research/services/researchSync.ts';

function memoryStorage() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,String(value))};
}

test('real API/SQL allocation: atomic blocks, retry, independent pools, manual tests and durable upload identity', {
  skip:!process.env.RESEARCH_TEST_PGLITE_MODULE && 'SQL runtime not configured',
},async t=>{
  const {PGlite}=await import(process.env.RESEARCH_TEST_PGLITE_MODULE);
  const db=new PGlite();
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-research-allocation-tests',
    optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false}});
  const env={SUPABASE_URL:'https://database.example',SUPABASE_SECRET_KEY:'test-database-key',VERCEL_ENV:'production'};
  for(const [key,value] of Object.entries(env)){
    const previous=process.env[key]; process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  try{
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql=await readFile(new URL('../supabase/research-results.sql',import.meta.url),'utf8');
    await db.exec(sql); await db.exec(sql); await db.exec('set role service_role');
    const api=await server.ssrLoadModule('/api/research.ts');
    t.mock.method(globalThis,'fetch',async (url,options)=>{
      assert.equal(options.headers.apikey,'test-database-key');
      const p=JSON.parse(options.body);
      try{
        const result=String(url).endsWith('/assign_research_sequence')
          ? await db.query('select public.assign_research_sequence($1,$2,$3,$4,$5) as result',
            [p.p_participant_id,p.p_write_token_hash,p.p_created_at,p.p_environment,p.p_requested_sequence])
          : await db.query('select public.save_research_result($1,$2,$3,$4,$5::jsonb) as result',
            [p.p_participant_id,p.p_sequence_id,p.p_revision,p.p_write_token_hash,JSON.stringify(p.p_data)]);
        return Response.json(result.rows[0].result);
      }catch(e){return Response.json({code:e.code},{status:400});}
    });
    const client=(_url,options)=>api.POST(new Request('https://research.example/api/research',
      {...options,headers:{...options.headers,Origin:'https://research.example'}}));
    const browsers=Array.from({length:8},()=>memoryStorage());
    const sessions=await Promise.all(browsers.map((local,index)=>requestResearchSession(local,'',
      ()=>`participant_production_${index}`,client)));
    const rows=(await db.query('select * from public.research_results order by (data->\'assignment\'->>\'position\')::int')).rows;
    assert.equal(rows.length,8);
    for(let block=0;block<2;block++)assert.deepEqual(rows.slice(block*4,block*4+4).map(r=>r.sequence_id).sort(),['A','B','C','D']);
    assert.deepEqual(rows.map(r=>r.data.assignment.position),[1,2,3,4,5,6,7,8]);
    assert.ok(rows.every(r=>r.data.collection_environment==='production'));

    // Lost response/reload retries the same ID/token; changed links cannot reassign it.
    const restored=await requestResearchSession(browsers[0],'?sequence=D',()=>{throw Error('new ID forbidden');},client);
    assert.deepEqual(restored,sessions[0]);
    assert.equal((await db.query('select count(*)::int as n from public.research_results')).rows[0].n,8);
    const wrongToken=await client('/api/research',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+'0'.repeat(64)},
      body:JSON.stringify({action:'assign_sequence',participant_id:sessions[0].participantId,created_at:sessions[0].createdAt,requested_sequence:null})});
    assert.equal(wrongToken.status,403);

    // Manual links on Production are test records and consume no automatic slot.
    const manualLocal=memoryStorage();
    const manual=await requestResearchSession(manualLocal,'?sequence=B',()=> 'participant_manual_case',client);
    assert.equal(manual.sequenceId,'B');
    let manualRow=(await db.query('select * from public.research_results where participant_id=$1',[manual.participantId])).rows[0];
    assert.equal(manualRow.data.collection_environment,'test');
    assert.deepEqual(manualRow.data.assignment,{source:'manual'});

    const payload={schema_version:1,experiment_version:'collection-v1',participant_id:manual.participantId,
      sequence_id:manual.sequenceId,session:manual,attempts:[],events:[],
      assignment:{source:'automatic',position:999},collection_environment:'production'};
    const sender=createResearchSync({storage:manualLocal,makeToken:id=>researchAssignmentToken(manualLocal,id),
      schedule:()=>1,cancel(){},send:async (payload,revision,token)=>{
        const response=await client('/api/research',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({payload,revision})});
        assert.equal(response.status,200);
      }});
    sender.enqueue(payload); await sender.flush(); sender.stop();
    manualRow=(await db.query('select * from public.research_results where participant_id=$1',[manual.participantId])).rows[0];
    assert.equal(manualRow.data.collection_environment,'test');
    assert.deepEqual(manualRow.data.assignment,{source:'manual'});

    process.env.VERCEL_ENV='preview';
    await Promise.all(Array.from({length:8},(_,i)=>requestResearchSession(memoryStorage(),'',()=>`participant_preview_${i}`,client)));
    const preview=(await db.query("select * from public.research_results where data->'assignment'->>'source'='automatic' and data->>'collection_environment'='test' order by (data->'assignment'->>'position')::int")).rows;
    assert.deepEqual(preview.map(r=>r.data.assignment.position),[1,2,3,4,5,6,7,8]);
    for(let block=0;block<2;block++)assert.deepEqual(preview.slice(block*4,block*4+4).map(r=>r.sequence_id).sort(),['A','B','C','D']);
    process.env.VERCEL_ENV='production';
    await requestResearchSession(memoryStorage(),'',()=> 'participant_production_ninth',client);
    const ninth=(await db.query("select data->'assignment'->>'position' as position from public.research_results where participant_id='participant_production_ninth'")).rows[0];
    assert.equal(ninth.position,'9');

    for(const role of ['anon','authenticated']){
      await db.exec('reset role'); await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select public.assign_research_sequence($1,$2,$3,$4,$5)',
        ['participant_denied_case','a'.repeat(64),new Date().toISOString(),'production',null]),e=>e.code==='42501');
    }
  }finally{await server.close();await db.close();}
});
