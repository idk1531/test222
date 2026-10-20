// v8.2 書房照片級貼圖介接（public/textures/study-room／見 scripts/make-room-textures.sh）。
//
// 設計原則：**永遠不阻塞場景**。3D 元件先用既有程序化 canvas 紋理把房間建好，
// 再非同步換上照片級 albedo；載入失敗（無資產、離線、404）就靜默保留程序化版本，
// 因此本模組不改變 v8.1 的「無外部請求依賴、離線可用」行為契約。
//
// 只吃 TEXTURES.files 的 albedo 圖；不做 normal／roughness 圖，避免與
// 現有 MeshStandardMaterial 參數（roughness／ACES）疊出雙層光照。
import * as THREE from "three";
import { TEXTURES, type TextureKey } from "./room3d";

/** 具備 map／color 的材質（MeshStandardMaterial／MeshBasicMaterial 皆可） */
type MappedMaterial = THREE.Material & {
  map: THREE.Texture | null;
  alphaMap?: THREE.Texture | null;
  color?: THREE.Color;
};

export interface AttachOptions {
  /** 平貼重複次數；預設 RepeatWrapping */
  repeat?: [number, number];
  /** true（預設）＝RepeatWrapping 平貼；false＝ClampToEdgeWrapping（單張畫面，如窗景） */
  tileable?: boolean;
  /** 換上照片貼圖時同時覆寫 material.color（程序化底色會與 albedo 相乘，需拉回白色） */
  tint?: string;
  /** 材質異向性過濾上限；一般傳 renderer.capabilities.getMaxAnisotropy() 的較小值 */
  anisotropy?: number;
  /** 單張照片的取樣範圍（窗景只取庭園下緣，避免窗內看到一片深色樹冠） */
  uv?: { repeat?: [number, number]; offset?: [number, number] };
  /**
   * true（預設）＝SRGBColorSpace（albedo）；
   * false＝NoColorSpace（alphaMap／遮罩類貼圖，v8.3 的橫紋簾與葉片剪影）。
   */
  srgb?: boolean;
  /** 貼到哪個貼圖槽：map（預設，albedo）或 alphaMap（遮罩） */
  slot?: "map" | "alphaMap";
}

/** 相對路徑 → 含部署前綴的絕對 URL（basePath 為空時為 `/textures/...`） */
export function assetUrl(relPath: string): string {
  const clean = relPath.replace(/^\/+/, "");
  if (typeof document === "undefined") return `/${clean}`;
  try {
    return new URL(clean, document.baseURI).toString();
  } catch {
    return `/${clean}`;
  }
}

export function textureUrl(key: TextureKey): string {
  return assetUrl(`${TEXTURES.dir}/${TEXTURES.files[key]}`);
}

/**
 * 非阻塞地把照片級 albedo 換到材質上。
 * 回傳 cancel／dispose：卸載時一併呼叫，避免 StrictMode 雙掛載把貼圖掛在已 dispose 的材質上。
 */
export function attachPhotoMap(
  mat: MappedMaterial,
  key: TextureKey,
  opts: AttachOptions = {}
): () => void {
  if (!TEXTURES.enabled) return () => {};
  let cancelled = false;
  let applied: THREE.Texture | null = null;

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    textureUrl(key),
    (tex) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      tex.anisotropy = Math.max(1, opts.anisotropy ?? 4);
      const wrap = opts.tileable === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      tex.wrapS = tex.wrapT = wrap;
      if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
      if (opts.uv?.repeat) tex.repeat.set(opts.uv.repeat[0], opts.uv.repeat[1]);
      if (opts.uv?.offset) tex.offset.set(opts.uv.offset[0], opts.uv.offset[1]);
      tex.needsUpdate = true;
      const slot = opts.slot === "alphaMap" ? "alphaMap" : "map";
      const old = mat[slot];
      mat[slot] = tex;
      if (opts.tint) mat.color?.set(opts.tint);
      mat.needsUpdate = true;
      if (old) old.dispose(); // 舊程序化紋理由材質獨享，直接釋放
      applied = tex;
    },
    undefined,
    () => {
      // 載入失敗：保留程序化紋理，不打斷場景建立
    }
  );

  return () => {
    cancelled = true;
    if (applied) {
      applied.dispose();
      applied = null;
    }
  };
}

/**
 * v8.3：大理石柔反射用的極便宜 envMap。
 * 同一張窗外庭園圖 → EquirectangularReflectionMapping → PMREMGenerator，
 * 只產生一次（桌機）；回傳 cancel／dispose，卸載時釋放 envMap 與暫存貼圖。
 * 手機端由呼叫端跳過（省 init 成本）。
 */
export function attachEnvironment(
  renderer: THREE.WebGLRenderer,
  key: TextureKey,
  onReady: (envMap: THREE.Texture) => void
): () => void {
  if (!TEXTURES.enabled) return () => {};
  let cancelled = false;
  let applied: THREE.Texture | null = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    textureUrl(key),
    (src) => {
      if (cancelled) {
        src.dispose();
        pmrem.dispose();
        return;
      }
      src.mapping = THREE.EquirectangularReflectionMapping;
      src.colorSpace = THREE.SRGBColorSpace;
      const rt = pmrem.fromEquirectangular(src);
      const env = rt.texture;
      src.dispose();
      pmrem.dispose();
      applied = env;
      onReady(env);
    },
    undefined,
    () => {
      pmrem.dispose();
      // 失敗：沒有 envMap，材質改走既有的 roughness／metalness 近似
    }
  );
  return () => {
    cancelled = true;
    applied?.dispose();
    applied = null;
  };
}
