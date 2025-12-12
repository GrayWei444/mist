let wasm;

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const AesGcmCipherFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_aesgcmcipher_free(ptr >>> 0, 1));

const EncryptedMessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_encryptedmessage_free(ptr >>> 0, 1));

const IdentityKeyPairFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_identitykeypair_free(ptr >>> 0, 1));

const RatchetMessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ratchetmessage_free(ptr >>> 0, 1));

const RatchetSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ratchetsession_free(ptr >>> 0, 1));

const X25519KeyPairFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_x25519keypair_free(ptr >>> 0, 1));

const X3DHFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_x3dh_free(ptr >>> 0, 1));

const X3DHInitialMessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_x3dhinitialmessage_free(ptr >>> 0, 1));

const X3DHSenderOutputFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_x3dhsenderoutput_free(ptr >>> 0, 1));

/**
 * AES-256-GCM 加密器
 */
export class AesGcmCipher {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AesGcmCipherFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_aesgcmcipher_free(ptr, 0);
    }
    /**
     * 從金鑰建立加密器
     * @param {Uint8Array} key
     */
    constructor(key) {
        const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.aesgcmcipher_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        AesGcmCipherFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 加密訊息
     * @param {Uint8Array} plaintext
     * @returns {EncryptedMessage}
     */
    encrypt(plaintext) {
        const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.aesgcmcipher_encrypt(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EncryptedMessage.__wrap(ret[0]);
    }
    /**
     * 加密訊息 (附帶關聯資料)
     * @param {Uint8Array} plaintext
     * @param {Uint8Array} aad
     * @returns {EncryptedMessage}
     */
    encryptWithAad(plaintext, aad) {
        const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(aad, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.aesgcmcipher_encryptWithAad(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EncryptedMessage.__wrap(ret[0]);
    }
    /**
     * 解密訊息
     * @param {EncryptedMessage} encrypted
     * @returns {Uint8Array}
     */
    decrypt(encrypted) {
        _assertClass(encrypted, EncryptedMessage);
        const ret = wasm.aesgcmcipher_decrypt(this.__wbg_ptr, encrypted.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 解密訊息 (附帶關聯資料)
     * @param {EncryptedMessage} encrypted
     * @param {Uint8Array} aad
     * @returns {Uint8Array}
     */
    decryptWithAad(encrypted, aad) {
        _assertClass(encrypted, EncryptedMessage);
        const ptr0 = passArray8ToWasm0(aad, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.aesgcmcipher_decryptWithAad(this.__wbg_ptr, encrypted.__wbg_ptr, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
}
if (Symbol.dispose) AesGcmCipher.prototype[Symbol.dispose] = AesGcmCipher.prototype.free;

/**
 * 加密後的訊息結構
 */
export class EncryptedMessage {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(EncryptedMessage.prototype);
        obj.__wbg_ptr = ptr;
        EncryptedMessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EncryptedMessageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_encryptedmessage_free(ptr, 0);
    }
    /**
     * 取得密文
     * @returns {Uint8Array}
     */
    get ciphertext() {
        const ret = wasm.encryptedmessage_ciphertext(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 取得 nonce
     * @returns {Uint8Array}
     */
    get nonce() {
        const ret = wasm.encryptedmessage_nonce(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 合併為單一位元組陣列 (nonce || ciphertext)
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.encryptedmessage_toBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 從位元組陣列還原
     * @param {Uint8Array} bytes
     * @returns {EncryptedMessage}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.encryptedmessage_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EncryptedMessage.__wrap(ret[0]);
    }
    /**
     * 序列化為 JSON
     * @returns {string}
     */
    toJson() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.encryptedmessage_toJson(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 從 JSON 還原
     * @param {string} json
     * @returns {EncryptedMessage}
     */
    static fromJson(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.encryptedmessage_fromJson(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EncryptedMessage.__wrap(ret[0]);
    }
}
if (Symbol.dispose) EncryptedMessage.prototype[Symbol.dispose] = EncryptedMessage.prototype.free;

/**
 * 身份金鑰對 (Ed25519)
 * 用於簽章和身份驗證，長期使用
 */
export class IdentityKeyPair {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IdentityKeyPair.prototype);
        obj.__wbg_ptr = ptr;
        IdentityKeyPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IdentityKeyPairFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_identitykeypair_free(ptr, 0);
    }
    /**
     * 生成新的身份金鑰對
     */
    constructor() {
        const ret = wasm.identitykeypair_new();
        this.__wbg_ptr = ret >>> 0;
        IdentityKeyPairFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 從私鑰位元組還原
     * @param {Uint8Array} bytes
     * @returns {IdentityKeyPair}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.identitykeypair_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return IdentityKeyPair.__wrap(ret[0]);
    }
    /**
     * 取得公鑰 (Base64)
     * @returns {string}
     */
    publicKeyBase64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.identitykeypair_publicKeyBase64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 取得公鑰位元組
     * @returns {Uint8Array}
     */
    publicKeyBytes() {
        const ret = wasm.identitykeypair_publicKeyBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 取得私鑰位元組 (敏感！僅用於備份)
     * @returns {Uint8Array}
     */
    privateKeyBytes() {
        const ret = wasm.identitykeypair_privateKeyBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 簽署訊息
     * @param {Uint8Array} message
     * @returns {Uint8Array}
     */
    sign(message) {
        const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.identitykeypair_sign(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
    /**
     * 驗證簽章
     * @param {Uint8Array} public_key
     * @param {Uint8Array} message
     * @param {Uint8Array} signature
     * @returns {boolean}
     */
    static verifySignature(public_key, message, signature) {
        const ptr0 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.identitykeypair_verifySignature(ptr0, len0, ptr1, len1, ptr2, len2);
        return ret !== 0;
    }
}
if (Symbol.dispose) IdentityKeyPair.prototype[Symbol.dispose] = IdentityKeyPair.prototype.free;

/**
 * 加密後的 Ratchet 訊息
 */
export class RatchetMessage {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(RatchetMessage.prototype);
        obj.__wbg_ptr = ptr;
        RatchetMessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RatchetMessageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ratchetmessage_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get dhPublic() {
        const ret = wasm.ratchetmessage_dhPublic(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get prevChainCount() {
        const ret = wasm.ratchetmessage_prevChainCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get messageNumber() {
        const ret = wasm.ratchetmessage_messageNumber(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    get ciphertext() {
        const ret = wasm.ratchetmessage_ciphertext(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get nonce() {
        const ret = wasm.ratchetmessage_nonce(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {string}
     */
    toJson() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.ratchetmessage_toJson(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {string} json
     * @returns {RatchetMessage}
     */
    static fromJson(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetmessage_fromJson(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetMessage.__wrap(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.ratchetmessage_toBytes(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {RatchetMessage}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetmessage_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetMessage.__wrap(ret[0]);
    }
    /**
     * @returns {string}
     */
    get dhPublicBase64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.ratchetmessage_dhPublicBase64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) RatchetMessage.prototype[Symbol.dispose] = RatchetMessage.prototype.free;

/**
 * Double Ratchet 會話狀態
 */
export class RatchetSession {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(RatchetSession.prototype);
        obj.__wbg_ptr = ptr;
        RatchetSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RatchetSessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ratchetsession_free(ptr, 0);
    }
    /**
     * 發起者建立會話 (Alice)
     *
     * # 參數
     * - `shared_secret`: X3DH 產生的共享密鑰
     * - `remote_public_key`: 接收者的 Signed PreKey 公鑰
     * - `ephemeral_private_key`: Alice 的 X3DH 臨時私鑰
     * - `ephemeral_public_key`: Alice 的 X3DH 臨時公鑰
     * @param {Uint8Array} shared_secret
     * @param {Uint8Array} remote_public_key
     * @param {Uint8Array} ephemeral_private_key
     * @param {Uint8Array} ephemeral_public_key
     * @returns {RatchetSession}
     */
    static initAsAlice(shared_secret, remote_public_key, ephemeral_private_key, ephemeral_public_key) {
        const ptr0 = passArray8ToWasm0(shared_secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(remote_public_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(ephemeral_private_key, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(ephemeral_public_key, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetsession_initAsAlice(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetSession.__wrap(ret[0]);
    }
    /**
     * 接收者建立會話 (Bob)
     *
     * # 參數
     * - `shared_secret`: X3DH 產生的共享密鑰
     * - `signed_prekey_private`: Bob 的 Signed PreKey 私鑰
     * - `signed_prekey_public`: Bob 的 Signed PreKey 公鑰
     * - `remote_ephemeral_public`: Alice 的臨時公鑰 (用於雙向通訊)
     * @param {Uint8Array} shared_secret
     * @param {Uint8Array} signed_prekey_private
     * @param {Uint8Array} signed_prekey_public
     * @param {Uint8Array} remote_ephemeral_public
     * @returns {RatchetSession}
     */
    static initAsBob(shared_secret, signed_prekey_private, signed_prekey_public, remote_ephemeral_public) {
        const ptr0 = passArray8ToWasm0(shared_secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(signed_prekey_private, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(signed_prekey_public, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(remote_ephemeral_public, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetsession_initAsBob(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetSession.__wrap(ret[0]);
    }
    /**
     * 加密訊息
     * @param {Uint8Array} plaintext
     * @returns {RatchetMessage}
     */
    encrypt(plaintext) {
        const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetsession_encrypt(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetMessage.__wrap(ret[0]);
    }
    /**
     * 解密訊息
     * @param {RatchetMessage} message
     * @returns {Uint8Array}
     */
    decrypt(message) {
        _assertClass(message, RatchetMessage);
        const ret = wasm.ratchetsession_decrypt(this.__wbg_ptr, message.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 序列化會話狀態
     * @returns {Uint8Array}
     */
    serialize() {
        const ret = wasm.ratchetsession_serialize(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 還原會話狀態
     * @param {Uint8Array} bytes
     * @returns {RatchetSession}
     */
    static deserialize(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ratchetsession_deserialize(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return RatchetSession.__wrap(ret[0]);
    }
    /**
     * 取得我方當前 DH 公鑰
     * @returns {Uint8Array}
     */
    get myPublicKey() {
        const ret = wasm.ratchetsession_myPublicKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 取得我方當前 DH 公鑰 (Base64)
     * @returns {string}
     */
    get myPublicKeyBase64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.ratchetsession_myPublicKeyBase64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) RatchetSession.prototype[Symbol.dispose] = RatchetSession.prototype.free;

/**
 * X25519 金鑰對
 * 用於 Diffie-Hellman 金鑰交換
 */
export class X25519KeyPair {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(X25519KeyPair.prototype);
        obj.__wbg_ptr = ptr;
        X25519KeyPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        X25519KeyPairFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_x25519keypair_free(ptr, 0);
    }
    /**
     * 生成新的 X25519 金鑰對
     */
    constructor() {
        const ret = wasm.x25519keypair_new();
        this.__wbg_ptr = ret >>> 0;
        X25519KeyPairFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 從私鑰位元組還原
     * @param {Uint8Array} bytes
     * @returns {X25519KeyPair}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.x25519keypair_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return X25519KeyPair.__wrap(ret[0]);
    }
    /**
     * 取得公鑰 (Base64)
     * @returns {string}
     */
    publicKeyBase64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.x25519keypair_publicKeyBase64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 取得公鑰位元組
     * @returns {Uint8Array}
     */
    publicKeyBytes() {
        const ret = wasm.x25519keypair_publicKeyBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 取得私鑰位元組 (敏感！)
     * @returns {Uint8Array}
     */
    privateKeyBytes() {
        const ret = wasm.x25519keypair_privateKeyBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * 執行 Diffie-Hellman 金鑰交換
     * @param {Uint8Array} their_public
     * @returns {Uint8Array}
     */
    diffieHellman(their_public) {
        const ptr0 = passArray8ToWasm0(their_public, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.x25519keypair_diffieHellman(this.__wbg_ptr, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
}
if (Symbol.dispose) X25519KeyPair.prototype[Symbol.dispose] = X25519KeyPair.prototype.free;

/**
 * X3DH 協定實作
 */
export class X3DH {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        X3DHFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_x3dh_free(ptr, 0);
    }
    /**
     * 發起者：計算共享密鑰
     *
     * # 參數
     * - `sender_identity`: 發送者的身份金鑰對
     * - `recipient_bundle`: 接收者的 PreKeyBundle
     *
     * # 返回
     * - X3DHSenderOutput 包含共享密鑰和臨時公鑰
     * @param {Uint8Array} sender_identity_private
     * @param {Uint8Array} recipient_identity_public
     * @param {Uint8Array} recipient_signed_prekey_public
     * @param {Uint8Array} recipient_signed_prekey_signature
     * @param {Uint8Array | null} [recipient_one_time_prekey_public]
     * @param {number | null} [recipient_one_time_prekey_id]
     * @returns {X3DHSenderOutput}
     */
    static initiatorCalculate(sender_identity_private, recipient_identity_public, recipient_signed_prekey_public, recipient_signed_prekey_signature, recipient_one_time_prekey_public, recipient_one_time_prekey_id) {
        const ptr0 = passArray8ToWasm0(sender_identity_private, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(recipient_identity_public, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(recipient_signed_prekey_public, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(recipient_signed_prekey_signature, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(recipient_one_time_prekey_public) ? 0 : passArray8ToWasm0(recipient_one_time_prekey_public, wasm.__wbindgen_malloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.x3dh_initiatorCalculate(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, isLikeNone(recipient_one_time_prekey_id) ? 0x100000001 : (recipient_one_time_prekey_id) >>> 0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return X3DHSenderOutput.__wrap(ret[0]);
    }
    /**
     * 接收者：計算共享密鑰
     * @param {Uint8Array} recipient_identity_private
     * @param {Uint8Array} recipient_signed_prekey_private
     * @param {Uint8Array | null | undefined} recipient_one_time_prekey_private
     * @param {Uint8Array} sender_identity_public
     * @param {Uint8Array} sender_ephemeral_public
     * @returns {Uint8Array}
     */
    static responderCalculate(recipient_identity_private, recipient_signed_prekey_private, recipient_one_time_prekey_private, sender_identity_public, sender_ephemeral_public) {
        const ptr0 = passArray8ToWasm0(recipient_identity_private, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(recipient_signed_prekey_private, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(recipient_one_time_prekey_private) ? 0 : passArray8ToWasm0(recipient_one_time_prekey_private, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(sender_identity_public, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(sender_ephemeral_public, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.x3dh_responderCalculate(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v6 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v6;
    }
    /**
     * 建立初始訊息
     * @param {Uint8Array} sender_identity_public
     * @param {Uint8Array} ephemeral_public
     * @param {number | null} [one_time_prekey_id]
     * @returns {X3DHInitialMessage}
     */
    static createInitialMessage(sender_identity_public, ephemeral_public, one_time_prekey_id) {
        const ptr0 = passArray8ToWasm0(sender_identity_public, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(ephemeral_public, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.x3dh_createInitialMessage(ptr0, len0, ptr1, len1, isLikeNone(one_time_prekey_id) ? 0x100000001 : (one_time_prekey_id) >>> 0);
        return X3DHInitialMessage.__wrap(ret);
    }
}
if (Symbol.dispose) X3DH.prototype[Symbol.dispose] = X3DH.prototype.free;

/**
 * X3DH 初始訊息 (發送給接收者)
 */
export class X3DHInitialMessage {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(X3DHInitialMessage.prototype);
        obj.__wbg_ptr = ptr;
        X3DHInitialMessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        X3DHInitialMessageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_x3dhinitialmessage_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get senderIdentityKey() {
        const ret = wasm.x3dhinitialmessage_senderIdentityKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get ephemeralKey() {
        const ret = wasm.x3dhinitialmessage_ephemeralKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number | undefined}
     */
    get oneTimePrekeyId() {
        const ret = wasm.x3dhinitialmessage_oneTimePrekeyId(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @returns {string}
     */
    toJson() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.x3dhinitialmessage_toJson(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {string} json
     * @returns {X3DHInitialMessage}
     */
    static fromJson(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.x3dhinitialmessage_fromJson(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return X3DHInitialMessage.__wrap(ret[0]);
    }
    /**
     * @returns {string}
     */
    get senderIdentityKeyBase64() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.x3dhinitialmessage_senderIdentityKeyBase64(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) X3DHInitialMessage.prototype[Symbol.dispose] = X3DHInitialMessage.prototype.free;

/**
 * X3DH 發起者輸出
 */
export class X3DHSenderOutput {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(X3DHSenderOutput.prototype);
        obj.__wbg_ptr = ptr;
        X3DHSenderOutputFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        X3DHSenderOutputFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_x3dhsenderoutput_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get sharedSecret() {
        const ret = wasm.x3dhsenderoutput_sharedSecret(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get ephemeralPublicKey() {
        const ret = wasm.x3dhsenderoutput_ephemeralPublicKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get ephemeralPrivateKey() {
        const ret = wasm.x3dhsenderoutput_ephemeralPrivateKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number | undefined}
     */
    get usedOneTimePrekeyId() {
        const ret = wasm.x3dhsenderoutput_usedOneTimePrekeyId(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @returns {string}
     */
    toJson() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.x3dhsenderoutput_toJson(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) X3DHSenderOutput.prototype[Symbol.dispose] = X3DHSenderOutput.prototype.free;

/**
 * 快速解密函式
 * @param {Uint8Array} key
 * @param {EncryptedMessage} encrypted
 * @returns {Uint8Array}
 */
export function aesDecrypt(key, encrypted) {
    const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(encrypted, EncryptedMessage);
    const ret = wasm.aesDecrypt(ptr0, len0, encrypted.__wbg_ptr);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * 從位元組直接解密
 * @param {Uint8Array} key
 * @param {Uint8Array} encrypted_bytes
 * @returns {Uint8Array}
 */
export function aesDecryptBytes(key, encrypted_bytes) {
    const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(encrypted_bytes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.aesDecryptBytes(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * 快速加密函式 (不需建立 Cipher 物件)
 * @param {Uint8Array} key
 * @param {Uint8Array} plaintext
 * @returns {EncryptedMessage}
 */
export function aesEncrypt(key, plaintext) {
    const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.aesEncrypt(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return EncryptedMessage.__wrap(ret[0]);
}

/**
 * Base64 解碼
 * @param {string} data
 * @returns {Uint8Array}
 */
export function base64Decode(data) {
    const ptr0 = passStringToWasm0(data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.base64Decode(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Base64 編碼
 * @param {Uint8Array} data
 * @returns {string}
 */
export function base64Encode(data) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.base64Encode(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * WASM 輔助函式：建立 PreKeyBundle JSON
 * @param {Uint8Array} identity_key
 * @param {number} signed_pre_key_id
 * @param {Uint8Array} signed_pre_key_public
 * @param {Uint8Array} signed_pre_key_signature
 * @param {bigint} signed_pre_key_timestamp
 * @param {number | null} [one_time_pre_key_id]
 * @param {Uint8Array | null} [one_time_pre_key_public]
 * @returns {string}
 */
export function createPreKeyBundleJson(identity_key, signed_pre_key_id, signed_pre_key_public, signed_pre_key_signature, signed_pre_key_timestamp, one_time_pre_key_id, one_time_pre_key_public) {
    let deferred6_0;
    let deferred6_1;
    try {
        const ptr0 = passArray8ToWasm0(identity_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(signed_pre_key_public, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(signed_pre_key_signature, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(one_time_pre_key_public) ? 0 : passArray8ToWasm0(one_time_pre_key_public, wasm.__wbindgen_malloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.createPreKeyBundleJson(ptr0, len0, signed_pre_key_id, ptr1, len1, ptr2, len2, signed_pre_key_timestamp, isLikeNone(one_time_pre_key_id) ? 0x100000001 : (one_time_pre_key_id) >>> 0, ptr3, len3);
        var ptr5 = ret[0];
        var len5 = ret[1];
        if (ret[3]) {
            ptr5 = 0; len5 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_free(deferred6_0, deferred6_1, 1);
    }
}

export function init() {
    wasm.init();
}

/**
 * 生成隨機位元組
 * @param {number} len
 * @returns {Uint8Array}
 */
export function randomBytes(len) {
    const ret = wasm.randomBytes(len);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * 簽署預金鑰
 * @param {Uint8Array} identity_private
 * @param {Uint8Array} prekey_public
 * @returns {Uint8Array}
 */
export function signPreKey(identity_private, prekey_public) {
    const ptr0 = passArray8ToWasm0(identity_private, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(prekey_public, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.signPreKey(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_Error_52673b7de5a0ca89 = function(arg0, arg1) {
        const ret = Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_function_8d400b8b1af978cd = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_object_ce774f3490692386 = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_string_704ef9c8fc131030 = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_undefined_f6b95eab589e0269 = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_call_3020136f7a2d6e44 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_abb4ff46ce38be40 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_crypto_574e78ad8b13b65f = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_length_22ac23eaec9d8053 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_log_1d990106d99dacb7 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_new_no_args_cb138f77cf6151ee = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_new_with_length_aa5eaf41d35235e5 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_node_905d3e251edff8a2 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_prototypesetcall_dfe9b766cdc1f1fd = function(arg0, arg1, arg2) {
        Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
    };
    imports.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_require_60cc747a6bc5215a = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_769e6b65d6557335 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_60cf02db4de8e1c1 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_08f5a74c69739274 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_a8924b26aa92d024 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_subarray_845f2f5bce7d061a = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_versions_c01dfd4722a88165 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_cast_cb9088102bce6b30 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
        const ret = getArrayU8FromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('safetalk_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
