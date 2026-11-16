let pipelinePromise;
self.onmessage=async ({data})=>{try{
 if(!pipelinePromise){self.postMessage({type:'status',text:'Loading the speech engine…'});pipelinePromise=(async()=>{const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;return pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'status',text:`Downloading speech model: ${p.file} · ${Math.round(p.progress)}%`});else if(p.status==='ready')self.postMessage({type:'status',text:'Speech model ready. Listening to your recording…'});}});})();}
 const transcriber=await pipelinePromise;self.postMessage({type:'status',text:'Transcribing your recording on this device. Longer calls can take several minutes…'});
 const result=await transcriber(data.audio,{chunk_length_s:30,stride_length_s:5,return_timestamps:true});self.postMessage({type:'done',result});
 }catch(e){pipelinePromise=null;self.postMessage({type:'error',text:e.message||String(e)});}};
