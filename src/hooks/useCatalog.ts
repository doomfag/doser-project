import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mergedCatalog,
  mergedClinicalReferences,
  readCatalogCache,
  writeCatalogCache,
  type CatalogCache,
} from "../data/catalogStore";
import {
  MAX_MEDICINES,
  parseCatalog,
  parseClinicalReferences,
  assertReferenceLinks,
  type ClinicalReference,
  type Medicine,
} from "../domain/catalog";
import { standalone } from "../data/runtime";
import { readEmbeddedCatalog } from "../data/embeddedCatalog";
import { shouldCheck, type UpdatePreferences } from "../domain/updateSchedule";
export interface OfficialStatus {
  count: number;
  lastSuccess?: string;
  lastAttempt?: string;
  lastError?: string;
  updating?: boolean;
  clinical?: {
    references: number;
    coveredRecords: number;
    documents: {
      id: string;
      title: string;
      status: string;
      checkedAt?: string;
      message?: string;
    }[];
  };
  report?: {
    rows: number;
    included: number;
    excluded: number;
    duplicates: number;
    missingIngredient: number;
    sha256: string;
  };
}
const preferenceKey = "doser.update.v1";
function readPreferences(): UpdatePreferences {
  try {
    const p = JSON.parse(localStorage.getItem(preferenceKey) || "null");
    return {
      automatic: !standalone && p?.automatic !== false,
      lastAttempt:
        typeof p?.lastAttempt === "string" ? p.lastAttempt : undefined,
    };
  } catch {
    return { automatic: !standalone };
  }
}
async function api<T>(path: string, method = "GET"): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: method === "POST" ? { "X-Doser-Request": "1" } : {},
    signal: AbortSignal.timeout(method === "POST" ? 120_000 : 15_000),
    cache: "no-store",
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Atualização indisponível neste modo. Inicie o Doser com npm start ou npm run dev.",
    );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.lastError ||
        data.error ||
        `Falha na atualização (HTTP ${response.status}).`,
    );
  return data as T;
}
export function useCatalog() {
  const [cache, setCache] = useState<CatalogCache>({
    manual: [],
    official: [],
  });
  const ref = useRef(cache);
  const storageHealthy = useRef(false);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<OfficialStatus>({ count: 0 });
  const [preferences, setPreferences] = useState(readPreferences);
  const [updating, setUpdating] = useState(false);
  const lock = useRef(false);
  const commit = useCallback(
    (transform: (current: CatalogCache) => CatalogCache) => {
      const operation = pending.current.then(async () => {
        const next = transform(ref.current);
        await writeCatalogCache(next);
        ref.current = next;
        setCache(next);
      });
      pending.current = operation.catch(() => {});
      return operation;
    },
    [],
  );
  const pullOfficial = useCallback(async () => {
    const snapshot = await api<{
      version: number;
      medicines: unknown[];
      clinicalReferences?: unknown[];
      status: OfficialStatus;
    }>("/api/catalog");
    const medicines = parseCatalog(snapshot);
    const references = parseClinicalReferences(
      snapshot.clinicalReferences ?? [],
    );
    assertReferenceLinks(medicines, references);
    if (!snapshot.status.lastSuccess || !medicines.length) return;
    await commit((current) => ({
      ...current,
      official: medicines,
      officialReferences: references,
      lastOfficialSuccess: snapshot.status.lastSuccess,
    }));
    setStatus(snapshot.status);
  }, [commit]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let saved: CatalogCache;
        try {
          saved = await readCatalogCache();
          storageHealthy.current = true;
        } catch (e) {
          if (!standalone) throw e;
          saved = { manual: [], official: [] };
          setError(
            "O navegador bloqueou o armazenamento do catálogo. A base incluída pode ser consultada nesta sessão, mas não será salva.",
          );
        }
        if (!active) return;
        ref.current = saved;
        setCache(saved);
        if (standalone) {
          const embedded = await readEmbeddedCatalog();
          if (!active) return;
          if (
            embedded &&
            (!saved.lastOfficialSuccess ||
              Date.parse(embedded.status.lastSuccess) >
                Date.parse(saved.lastOfficialSuccess))
          ) {
            const next = {
              ...saved,
              official: embedded.medicines,
              officialReferences: embedded.clinicalReferences,
              lastOfficialSuccess: embedded.status.lastSuccess,
            };
            if (storageHealthy.current) {
              try {
                await commit(() => next);
              } catch {
                storageHealthy.current = false;
                ref.current = next;
                setCache(next);
                setError(
                  "A base foi aberta, mas o navegador não conseguiu guardá-la. Mantenha este arquivo para consultar novamente.",
                );
              }
            } else {
              ref.current = next;
              setCache(next);
            }
          }
          if (embedded) setStatus(embedded.status);
          setReady(true);
          setBootstrapped(true);
          return;
        }
        setReady(true);
        const live = await api<OfficialStatus>("/api/catalog/status");
        if (!active) return;
        setStatus(live);
        if (live.lastSuccess && live.lastSuccess !== saved.lastOfficialSuccess)
          await pullOfficial();
        if (active) setBootstrapped(true);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Não foi possível ler o catálogo.",
          );
          setReady(true);
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [pullOfficial, commit]);
  const updateNow = useCallback(async () => {
    if (standalone) {
      setError(
        "Esta cópia portátil consulta a base incluída. Para renovar, importe um catálogo ou use o programa local.",
      );
      return;
    }
    if (lock.current || !ready) return;
    if (!storageHealthy.current) {
      setError(
        "O armazenamento do catálogo está indisponível. Verifique as permissões do navegador antes de atualizar.",
      );
      return;
    }
    lock.current = true;
    setUpdating(true);
    setError("");
    const nextPreferences = {
      ...preferences,
      lastAttempt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(nextPreferences));
      setPreferences(nextPreferences);
      const live = await api<OfficialStatus>("/api/catalog/update", "POST");
      setStatus(live);
      await pullOfficial();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Atualização interrompida. Sua base anterior foi mantida.",
      );
    } finally {
      lock.current = false;
      setUpdating(false);
    }
  }, [preferences, pullOfficial, ready]);
  useEffect(() => {
    if (!ready || !bootstrapped || standalone) return;
    const check = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        shouldCheck(preferences, cache.lastOfficialSuccess)
      )
        void updateNow();
    };
    const timer = setInterval(check, 60 * 60 * 1000);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [ready, bootstrapped, preferences, cache.lastOfficialSuccess, updateNow]);
  const setAutomatic = (automatic: boolean) => {
    const next = { ...preferences, automatic };
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      setPreferences(next);
      setError("");
    } catch {
      setError("Não foi possível salvar a preferência neste navegador.");
    }
  };
  const importManual = async (
    medicines: Medicine[],
    references: ClinicalReference[] = [],
  ) => {
    if (!ready) throw new Error("Aguarde o carregamento do catálogo.");
    if (!storageHealthy.current)
      throw new Error(
        "O armazenamento do catálogo está indisponível. Nenhum dado foi substituído.",
      );
    if (lock.current)
      throw new Error(
        "Aguarde a atualização atual terminar antes de importar.",
      );
    await commit((current) => {
      const map = new Map(current.manual.map((m) => [m.id, m]));
      for (const m of medicines) map.set(m.id, m);
      if (map.size > MAX_MEDICINES)
        throw new Error("Limite de 100.000 registros manuais excedido.");
      const referenceMap = new Map(
        (current.manualReferences ?? []).map((r) => [r.id, r]),
      );
      for (const r of references) referenceMap.set(r.id, r);
      const next = {
        ...current,
        manual: [...map.values()],
        manualReferences: [...referenceMap.values()],
      };
      assertReferenceLinks(mergedCatalog(next), mergedClinicalReferences(next));
      return next;
    });
  };
  const catalog = useMemo(() => mergedCatalog(cache), [cache]);
  const references = useMemo(() => mergedClinicalReferences(cache), [cache]);
  return {
    references,
    portable: standalone,
    catalog,
    ready,
    error,
    status,
    updating,
    preferences,
    updateNow,
    setAutomatic,
    importManual,
    officialCount: cache.official.length,
    lastSuccess: cache.lastOfficialSuccess,
  };
}
