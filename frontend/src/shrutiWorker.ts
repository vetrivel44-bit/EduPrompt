import * as ort from 'onnxruntime-web/wasm';
import {createShruti} from 'shruti-onnx';

const worker=self as any;
let model:Awaited<ReturnType<typeof createShruti>>|null=null;

worker.onmessage=async(event:MessageEvent<{samples:ArrayBuffer}>)=>{
  try{
    if(!model){worker.postMessage({type:'loading-model'});model=await createShruti({ort,language:'kn'});}
    worker.postMessage({type:'transcribing'});
    const samples=new Float32Array(event.data.samples);
    const result=await model.transcribe(samples,{loops:'cut'});
    worker.postMessage({type:'result',text:result.text});
  }catch(error:any){
    worker.postMessage({type:'error',message:String(error?.message||'Kannada transcription failed.')});
  }
};
