let s;const f=new Array(128).fill(void 0);f.push(void 0,null,!0,!1);function g(e){return f[e]}let h=f.length;function x(e){e<132||(f[e]=h,h=e)}function w(e){const n=g(e);return x(e),n}function b(e){h===f.length&&f.push(f.length+1);const n=h;return h=f[n],f[n]=e,n}const O=typeof TextDecoder<"u"?new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}):{decode:()=>{throw Error("TextDecoder not available")}};typeof TextDecoder<"u"&&O.decode();let d=null;function A(){return(d===null||d.byteLength===0)&&(d=new Uint8Array(s.memory.buffer)),d}function S(e,n){return e=e>>>0,O.decode(A().subarray(e,e+n))}function T(e){const n=typeof e;if(n=="number"||n=="boolean"||e==null)return`${e}`;if(n=="string")return`"${e}"`;if(n=="symbol"){const o=e.description;return o==null?"Symbol":`Symbol(${o})`}if(n=="function"){const o=e.name;return typeof o=="string"&&o.length>0?`Function(${o})`:"Function"}if(Array.isArray(e)){const o=e.length;let c="[";o>0&&(c+=T(e[0]));for(let i=1;i<o;i++)c+=", "+T(e[i]);return c+="]",c}const t=/\[object ([^\]]+)\]/.exec(toString.call(e));let r;if(t.length>1)r=t[1];else return toString.call(e);if(r=="Object")try{return"Object("+JSON.stringify(e)+")"}catch{return"Object"}return e instanceof Error?`${e.name}: ${e.message}
${e.stack}`:r}let u=0;const F=typeof TextEncoder<"u"?new TextEncoder("utf-8"):{encode:()=>{throw Error("TextEncoder not available")}},k=typeof F.encodeInto=="function"?function(e,n){return F.encodeInto(e,n)}:function(e,n){const t=F.encode(e);return n.set(t),{read:e.length,written:t.length}};function E(e,n,t){if(t===void 0){const _=F.encode(e),a=n(_.length,1)>>>0;return A().subarray(a,a+_.length).set(_),u=_.length,a}let r=e.length,o=n(r,1)>>>0;const c=A();let i=0;for(;i<r;i++){const _=e.charCodeAt(i);if(_>127)break;c[o+i]=_}if(i!==r){i!==0&&(e=e.slice(i)),o=t(o,r,r=i+e.length*3,1)>>>0;const _=A().subarray(o+i,o+r),a=k(e,_);i+=a.written,o=t(o,r,i,1)>>>0}return u=i,o}let y=null;function l(){return(y===null||y.byteLength===0)&&(y=new Int32Array(s.memory.buffer)),y}let m=null;function W(){return(m===null||m.byteLength===0)&&(m=new Float32Array(s.memory.buffer)),m}function p(e,n){const t=n(e.length*4,4)>>>0;return W().set(e,t/4),u=e.length,t}function M(e,n){return e=e>>>0,W().subarray(e/4,e/4+n)}const R=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(e=>s.__wbg_analysis_free(e>>>0));class I{__destroy_into_raw(){const n=this.__wbg_ptr;return this.__wbg_ptr=0,R.unregister(this),n}free(){const n=this.__destroy_into_raw();s.__wbg_analysis_free(n)}constructor(){const n=s.analysis_new();return this.__wbg_ptr=n>>>0,this}fft(n,t){const r=p(t,s.__wbindgen_malloc),o=u,c=s.analysis_fft(this.__wbg_ptr,n,r,o);return w(c)}decimate(n,t){try{const i=s.__wbindgen_add_to_stack_pointer(-16),_=p(t,s.__wbindgen_malloc),a=u;s.analysis_decimate(i,this.__wbg_ptr,n,_,a);var r=l()[i/4+0],o=l()[i/4+1],c=M(r,o).slice();return s.__wbindgen_free(r,o*4,4),c}finally{s.__wbindgen_add_to_stack_pointer(16)}}moving_avg(n,t){try{const i=s.__wbindgen_add_to_stack_pointer(-16),_=p(t,s.__wbindgen_malloc),a=u;s.analysis_moving_avg(i,this.__wbg_ptr,n,_,a);var r=l()[i/4+0],o=l()[i/4+1],c=M(r,o).slice();return s.__wbindgen_free(r,o*4,4),c}finally{s.__wbindgen_add_to_stack_pointer(16)}}transform(n,t,r){const o=p(r,s.__wbindgen_malloc),c=u,i=s.analysis_transform(this.__wbg_ptr,n,t,o,c);return w(i)}}async function L(e,n){if(typeof Response=="function"&&e instanceof Response){if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(e,n)}catch(r){if(e.headers.get("Content-Type")!="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",r);else throw r}const t=await e.arrayBuffer();return await WebAssembly.instantiate(t,n)}else{const t=await WebAssembly.instantiate(e,n);return t instanceof WebAssembly.Instance?{instance:t,module:e}:t}}function $(){const e={};return e.wbg={},e.wbg.__wbindgen_object_drop_ref=function(n){w(n)},e.wbg.__wbindgen_number_new=function(n){return b(n)},e.wbg.__wbindgen_string_new=function(n,t){const r=S(n,t);return b(r)},e.wbg.__wbindgen_object_clone_ref=function(n){const t=g(n);return b(t)},e.wbg.__wbg_set_f975102236d3c502=function(n,t,r){g(n)[w(t)]=w(r)},e.wbg.__wbg_new_16b304a2cfa7ff4a=function(){const n=new Array;return b(n)},e.wbg.__wbg_new_72fb9a18b5ae2624=function(){const n=new Object;return b(n)},e.wbg.__wbg_set_d4638f722068f043=function(n,t,r){g(n)[t>>>0]=w(r)},e.wbg.__wbg_new_abda76e883ba8a5f=function(){const n=new Error;return b(n)},e.wbg.__wbg_stack_658279fe44541cf6=function(n,t){const r=g(t).stack,o=E(r,s.__wbindgen_malloc,s.__wbindgen_realloc),c=u;l()[n/4+1]=c,l()[n/4+0]=o},e.wbg.__wbg_error_f851667af71bcfc6=function(n,t){let r,o;try{r=n,o=t,console.error(S(n,t))}finally{s.__wbindgen_free(r,o,1)}},e.wbg.__wbindgen_debug_string=function(n,t){const r=T(g(t)),o=E(r,s.__wbindgen_malloc,s.__wbindgen_realloc),c=u;l()[n/4+1]=c,l()[n/4+0]=o},e.wbg.__wbindgen_throw=function(n,t){throw new Error(S(n,t))},e}function U(e,n){return s=e.exports,j.__wbindgen_wasm_module=n,m=null,y=null,d=null,s}async function j(e){if(s!==void 0)return s;typeof e>"u"&&(e=new URL("/assets/analysis_bg-43a2106e.wasm",self.location));const n=$();(typeof e=="string"||typeof Request=="function"&&e instanceof Request||typeof URL=="function"&&e instanceof URL)&&(e=fetch(e));const{instance:t,module:r}=await L(await e,n);return U(t,r)}self.onmessage=async e=>{await j();const n=new I,t=Number(e.data.sampleFrequency),r=e.data.input,o=n.fft(t,r);self.postMessage(o)};
