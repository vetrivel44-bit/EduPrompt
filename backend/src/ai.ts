import {GoogleGenAI} from '@google/genai';
import {systemPrompt} from './prompts/systemPrompt.js';
import {evaluationSchema,followSchema,reportSchema} from './schemas.js';

async function requestGroq(prompt:string):Promise<unknown>{
  const key=process.env.GROQ_API_KEY;
  if(!key)throw Object.assign(new Error('Groq is not configured.'),{status:503,code:'NOT_CONFIGURED'});
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-20b',messages:[
      {role:'system',content:`${systemPrompt}\nReturn only a valid JSON object matching the requested fields and value types.`},
      {role:'user',content:prompt}],response_format:{type:'json_object'},include_reasoning:false,temperature:0.25,max_completion_tokens:850}),
    signal:AbortSignal.timeout(45_000)
  });
  if(!response.ok){const payload:any=await response.json().catch(()=>({}));const error:any=new Error('Groq request failed');error.status=response.status;error.providerMessage=String(payload?.error?.message||'');throw error;}
  const data:any=await response.json();const text=data.choices?.[0]?.message?.content?.trim();
  if(!text)throw new Error('Empty response');
  return JSON.parse(text);
}

async function requestGemini(prompt:string,schema:any):Promise<unknown>{
  const key=process.env.GEMINI_API_KEY;
  if(!key)throw Object.assign(new Error('Gemini is not configured.'),{status:503,code:'NOT_CONFIGURED'});
  const ai=new GoogleGenAI({apiKey:key});
  const response=await ai.models.generateContent({model:process.env.GEMINI_MODEL||'gemini-3.8-flash',contents:prompt,config:{systemInstruction:systemPrompt,responseMimeType:'application/json',responseSchema:schema.toJSONSchema(),maxOutputTokens:850,temperature:0.25}});
  const text=response.text?.trim();if(!text)throw new Error('Empty response');
  return JSON.parse(text);
}

function friendlyError(error:any){
  const status=error?.status||error?.httpStatusCode;
  if(status===429)return Object.assign(new Error('AI is busy. Please wait a moment and try again.'),{status:429,code:'RATE_LIMIT'});
  if(status===401||status===403)return Object.assign(new Error('The AI provider rejected the key or denied this project access. Check the key and model access.'),{status:502,code:'AI_AUTH'});
  if(status===400){const detail=String(error?.providerMessage||error?.message||'').toLowerCase();if(/model.{0,30}(not found|unavailable|not available|unsupported)|unsupported.{0,20}model|model_not_found/.test(detail))return Object.assign(new Error('The configured AI model is unavailable for this account. Please check the model setting.'),{status:502,code:'AI_MODEL'});return Object.assign(new Error('The AI provider could not process that request. Your answer is saved; please try again.'),{status:502,code:'AI_REQUEST'});}
  if(error?.code==='NOT_CONFIGURED')return Object.assign(new Error('No configured AI provider is available. Check the backend settings.'),{status:503,code:'NOT_CONFIGURED'});
  return Object.assign(new Error('The AI service is temporarily unavailable. Your session is saved; please try again.'),{status:502,code:'AI_UNAVAILABLE'});
}

export async function generate<T>(prompt:string,schema:any):Promise<T>{
  const primary=(process.env.AI_PROVIDER||'gemini').toLowerCase();
  const fallback=(process.env.AI_FALLBACK_PROVIDER||'').toLowerCase();
  const providers=[primary,...(fallback&&fallback!==primary?[fallback]:[])];
  let lastError:any;
  for(const provider of providers){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const parsed=provider==='groq'?await requestGroq(prompt):provider==='gemini'?await requestGemini(prompt,schema):(()=>{throw new Error(`Unsupported provider: ${provider}`)})();
        return schema.parse(parsed) as T;
      }catch(error:any){
        lastError=error;
        console.warn('AI provider request failed',provider,error?.status||error?.httpStatusCode||'network',error?.code||error?.name||'Error');
        if(attempt===0&&(error instanceof SyntaxError||error?.name==='ZodError'))continue;
        const status=error?.status||error?.httpStatusCode;
        if(attempt===0&&(status===429||status>=500||(!status&&error?.code!=='NOT_CONFIGURED'))){await new Promise(resolve=>setTimeout(resolve,700));continue;}
        break;
      }
    }
  }
  throw friendlyError(lastError);
}

export {evaluationSchema,followSchema,reportSchema};
