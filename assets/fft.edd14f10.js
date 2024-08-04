let s;const f=new Array(32).fill(void 0);f.push(void 0,null,!0,!1);function w(n){return f[n]}let y=f.length;function R(n){n<36||(f[n]=y,y=n)}function g(n){const t=w(n);return R(n),t}function l(n){y===f.length&&f.push(f.length+1);const t=y;return y=f[t],f[t]=n,t}const W=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});W.decode();let d=new Uint8Array;function m(){return d.byteLength===0&&(d=new Uint8Array(s.memory.buffer)),d}function j(n,t){return W.decode(m().subarray(n,n+t))}function S(n){const t=typeof n;if(t=="number"||t=="boolean"||n==null)return`${n}`;if(t=="string")return`"${n}"`;if(t=="symbol"){const o=n.description;return o==null?"Symbol":`Symbol(${o})`}if(t=="function"){const o=n.name;return typeof o=="string"&&o.length>0?`Function(${o})`:"Function"}if(Array.isArray(n)){const o=n.length;let i="[";o>0&&(i+=S(n[0]));for(let c=1;c<o;c++)i+=", "+S(n[c]);return i+="]",i}const e=/\[object ([^\]]+)\]/.exec(toString.call(n));let r;if(e.length>1)r=e[1];else return toString.call(n);if(r=="Object")try{return"Object("+JSON.stringify(n)+")"}catch{return"Object"}return n instanceof Error?`${n.name}: ${n.message}
${n.stack}`:r}let b=0;const p=new TextEncoder("utf-8"),T=typeof p.encodeInto=="function"?function(n,t){return p.encodeInto(n,t)}:function(n,t){const e=p.encode(n);return t.set(e),{read:n.length,written:e.length}};function I(n,t,e){if(e===void 0){const a=p.encode(n),_=t(a.length);return m().subarray(_,_+a.length).set(a),b=a.length,_}let r=n.length,o=t(r);const i=m();let c=0;for(;c<r;c++){const a=n.charCodeAt(c);if(a>127)break;i[o+c]=a}if(c!==r){c!==0&&(n=n.slice(c)),o=e(o,r,r=c+n.length*3);const a=m().subarray(o+c,o+r),_=T(n,a);c+=_.written}return b=c,o}let h=new Int32Array;function u(){return h.byteLength===0&&(h=new Int32Array(s.memory.buffer)),h}let A=new Float32Array;function k(){return A.byteLength===0&&(A=new Float32Array(s.memory.buffer)),A}function O(n,t){const e=t(n.length*4);return k().set(n,e/4),b=n.length,e}function M(n,t){return k().subarray(n/4,n/4+t)}class F{static __wrap(t){const e=Object.create(F.prototype);return e.ptr=t,e}__destroy_into_raw(){const t=this.ptr;return this.ptr=0,t}free(){const t=this.__destroy_into_raw();s.__wbg_analysis_free(t)}constructor(){const t=s.analysis_new();return F.__wrap(t)}fft(t,e){const r=O(e,s.__wbindgen_malloc),o=b,i=s.analysis_fft(this.ptr,t,r,o);return g(i)}decimate(t,e){try{const c=s.__wbindgen_add_to_stack_pointer(-16),a=O(e,s.__wbindgen_malloc),_=b;s.analysis_decimate(c,this.ptr,t,a,_);var r=u()[c/4+0],o=u()[c/4+1],i=M(r,o).slice();return s.__wbindgen_free(r,o*4),i}finally{s.__wbindgen_add_to_stack_pointer(16)}}moving_avg(t,e){try{const c=s.__wbindgen_add_to_stack_pointer(-16),a=O(e,s.__wbindgen_malloc),_=b;s.analysis_moving_avg(c,this.ptr,t,a,_);var r=u()[c/4+0],o=u()[c/4+1],i=M(r,o).slice();return s.__wbindgen_free(r,o*4),i}finally{s.__wbindgen_add_to_stack_pointer(16)}}}async function U(n,t){if(typeof Response=="function"&&n instanceof Response){if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(n,t)}catch(r){if(n.headers.get("Content-Type")!="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",r);else throw r}const e=await n.arrayBuffer();return await WebAssembly.instantiate(e,t)}else{const e=await WebAssembly.instantiate(n,t);return e instanceof WebAssembly.Instance?{instance:e,module:n}:e}}function x(){const n={};return n.wbg={},n.wbg.__wbindgen_object_drop_ref=function(t){g(t)},n.wbg.__wbindgen_number_new=function(t){return l(t)},n.wbg.__wbindgen_object_clone_ref=function(t){const e=w(t);return l(e)},n.wbg.__wbindgen_string_new=function(t,e){const r=j(t,e);return l(r)},n.wbg.__wbg_set_20cbc34131e76824=function(t,e,r){w(t)[g(e)]=g(r)},n.wbg.__wbg_new_1d9a920c6bfc44a8=function(){const t=new Array;return l(t)},n.wbg.__wbg_new_0b9bfdd97583284e=function(){const t=new Object;return l(t)},n.wbg.__wbg_set_a68214f35c417fa9=function(t,e,r){w(t)[e>>>0]=g(r)},n.wbg.__wbg_new_abda76e883ba8a5f=function(){const t=new Error;return l(t)},n.wbg.__wbg_stack_658279fe44541cf6=function(t,e){const r=w(e).stack,o=I(r,s.__wbindgen_malloc,s.__wbindgen_realloc),i=b;u()[t/4+1]=i,u()[t/4+0]=o},n.wbg.__wbg_error_f851667af71bcfc6=function(t,e){try{console.error(j(t,e))}finally{s.__wbindgen_free(t,e)}},n.wbg.__wbindgen_debug_string=function(t,e){const r=S(w(e)),o=I(r,s.__wbindgen_malloc,s.__wbindgen_realloc),i=b;u()[t/4+1]=i,u()[t/4+0]=o},n.wbg.__wbindgen_throw=function(t,e){throw new Error(j(t,e))},n}function L(n,t){return s=n.exports,E.__wbindgen_wasm_module=t,A=new Float32Array,h=new Int32Array,d=new Uint8Array,s}async function E(n){typeof n>"u"&&(n=new URL("/Blackbox-Analyzer/assets/analysis_bg.17cbd68c.wasm",self.location));const t=x();(typeof n=="string"||typeof Request=="function"&&n instanceof Request||typeof URL=="function"&&n instanceof URL)&&(n=fetch(n));const{instance:e,module:r}=await U(await n,t);return L(e,r)}self.onmessage=async n=>{await E();const t=new F,e=Number(n.data.sampleFrequency),r=n.data.input,o=t.fft(e,r);self.postMessage(o)};