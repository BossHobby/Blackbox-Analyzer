let s;const f=new Array(128).fill(void 0);f.push(void 0,null,!0,!1);function w(n){return f[n]}let p=f.length;function R(n){n<132||(f[n]=p,p=n)}function g(n){const t=w(n);return R(n),t}function b(n){p===f.length&&f.push(f.length+1);const t=p;return p=f[t],f[t]=n,t}const k=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});k.decode();let d=null;function A(){return(d===null||d.byteLength===0)&&(d=new Uint8Array(s.memory.buffer)),d}function O(n,t){return k.decode(A().subarray(n,n+t))}function S(n){const t=typeof n;if(t=="number"||t=="boolean"||n==null)return`${n}`;if(t=="string")return`"${n}"`;if(t=="symbol"){const o=n.description;return o==null?"Symbol":`Symbol(${o})`}if(t=="function"){const o=n.name;return typeof o=="string"&&o.length>0?`Function(${o})`:"Function"}if(Array.isArray(n)){const o=n.length;let i="[";o>0&&(i+=S(n[0]));for(let c=1;c<o;c++)i+=", "+S(n[c]);return i+="]",i}const e=/\[object ([^\]]+)\]/.exec(toString.call(n));let r;if(e.length>1)r=e[1];else return toString.call(n);if(r=="Object")try{return"Object("+JSON.stringify(n)+")"}catch{return"Object"}return n instanceof Error?`${n.name}: ${n.message}
${n.stack}`:r}let u=0;const j=new TextEncoder("utf-8"),T=typeof j.encodeInto=="function"?function(n,t){return j.encodeInto(n,t)}:function(n,t){const e=j.encode(n);return t.set(e),{read:n.length,written:e.length}};function M(n,t,e){if(e===void 0){const a=j.encode(n),_=t(a.length);return A().subarray(_,_+a.length).set(a),u=a.length,_}let r=n.length,o=t(r);const i=A();let c=0;for(;c<r;c++){const a=n.charCodeAt(c);if(a>127)break;i[o+c]=a}if(c!==r){c!==0&&(n=n.slice(c)),o=e(o,r,r=c+n.length*3);const a=A().subarray(o+c,o+r),_=T(n,a);c+=_.written}return u=c,o}let y=null;function l(){return(y===null||y.byteLength===0)&&(y=new Int32Array(s.memory.buffer)),y}let m=null;function I(){return(m===null||m.byteLength===0)&&(m=new Float32Array(s.memory.buffer)),m}function h(n,t){const e=t(n.length*4);return I().set(n,e/4),u=n.length,e}function W(n,t){return I().subarray(n/4,n/4+t)}class F{static __wrap(t){const e=Object.create(F.prototype);return e.ptr=t,e}__destroy_into_raw(){const t=this.ptr;return this.ptr=0,t}free(){const t=this.__destroy_into_raw();s.__wbg_analysis_free(t)}constructor(){const t=s.analysis_new();return F.__wrap(t)}fft(t,e){const r=h(e,s.__wbindgen_malloc),o=u,i=s.analysis_fft(this.ptr,t,r,o);return g(i)}decimate(t,e){try{const c=s.__wbindgen_add_to_stack_pointer(-16),a=h(e,s.__wbindgen_malloc),_=u;s.analysis_decimate(c,this.ptr,t,a,_);var r=l()[c/4+0],o=l()[c/4+1],i=W(r,o).slice();return s.__wbindgen_free(r,o*4),i}finally{s.__wbindgen_add_to_stack_pointer(16)}}moving_avg(t,e){try{const c=s.__wbindgen_add_to_stack_pointer(-16),a=h(e,s.__wbindgen_malloc),_=u;s.analysis_moving_avg(c,this.ptr,t,a,_);var r=l()[c/4+0],o=l()[c/4+1],i=W(r,o).slice();return s.__wbindgen_free(r,o*4),i}finally{s.__wbindgen_add_to_stack_pointer(16)}}transform(t,e,r){const o=h(r,s.__wbindgen_malloc),i=u,c=s.analysis_transform(this.ptr,t,e,o,i);return g(c)}}async function x(n,t){if(typeof Response=="function"&&n instanceof Response){if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(n,t)}catch(r){if(n.headers.get("Content-Type")!="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",r);else throw r}const e=await n.arrayBuffer();return await WebAssembly.instantiate(e,t)}else{const e=await WebAssembly.instantiate(n,t);return e instanceof WebAssembly.Instance?{instance:e,module:n}:e}}function L(){const n={};return n.wbg={},n.wbg.__wbindgen_object_drop_ref=function(t){g(t)},n.wbg.__wbindgen_number_new=function(t){return b(t)},n.wbg.__wbindgen_object_clone_ref=function(t){const e=w(t);return b(e)},n.wbg.__wbindgen_string_new=function(t,e){const r=O(t,e);return b(r)},n.wbg.__wbg_set_20cbc34131e76824=function(t,e,r){w(t)[g(e)]=g(r)},n.wbg.__wbg_new_b525de17f44a8943=function(){const t=new Array;return b(t)},n.wbg.__wbg_new_f9876326328f45ed=function(){const t=new Object;return b(t)},n.wbg.__wbg_set_17224bc548dd1d7b=function(t,e,r){w(t)[e>>>0]=g(r)},n.wbg.__wbg_new_abda76e883ba8a5f=function(){const t=new Error;return b(t)},n.wbg.__wbg_stack_658279fe44541cf6=function(t,e){const r=w(e).stack,o=M(r,s.__wbindgen_malloc,s.__wbindgen_realloc),i=u;l()[t/4+1]=i,l()[t/4+0]=o},n.wbg.__wbg_error_f851667af71bcfc6=function(t,e){try{console.error(O(t,e))}finally{s.__wbindgen_free(t,e)}},n.wbg.__wbindgen_debug_string=function(t,e){const r=S(w(e)),o=M(r,s.__wbindgen_malloc,s.__wbindgen_realloc),i=u;l()[t/4+1]=i,l()[t/4+0]=o},n.wbg.__wbindgen_throw=function(t,e){throw new Error(O(t,e))},n}function $(n,t){return s=n.exports,E.__wbindgen_wasm_module=t,m=null,y=null,d=null,s}async function E(n){typeof n>"u"&&(n=new URL("/Blackbox-Analyzer/assets/analysis_bg.956d58f4.wasm",self.location));const t=L();(typeof n=="string"||typeof Request=="function"&&n instanceof Request||typeof URL=="function"&&n instanceof URL)&&(n=fetch(n));const{instance:e,module:r}=await x(await n,t);return $(e,r)}self.onmessage=async n=>{await E();const t=new F,e=Number(n.data.sampleFrequency),r=n.data.input,o=t.fft(e,r);self.postMessage(o)};
