import { nativeAndroid } from "./data/runtime";
import { savePortableApplication } from "./data/savePortable";
import DoseConverter from "./components/DoseConverter";
import ComparisonFact from "./components/ComparisonFact";
import {
  clinicalReferencesFor,
  parseClinicalReferences,
} from "./domain/catalog";
import ReadingProgress from "./components/ReadingProgress";
import { useCatalog } from "./hooks/useCatalog";
import CatalogUpdates from "./components/CatalogUpdates";
import MedicineDetail from "./pages/MedicineDetail";
import PricesPage from "./pages/PricesPage";
import { External, PageHeading, Empty } from "./components/ui";
import { sources } from "./data/sources";
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useDeferredValue,
  type FormEvent,
} from "react";
import {
  Calculator,
  Home,
  Scale,
  Tag,
  BookOpen,
  Search,
  Pill,
  Stethoscope,
  FlaskConical,
  Clock3,
  Star,
  FileText,
  ChevronRight,
  ArrowUpRight,
  X,
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  Database,
  Settings2,
  AlertCircle,
} from "lucide-react";
import {
  compare,
  parseCatalog,
  createSearchIndex,
  isApproximateMatch,
  searchIndex,
  sectionLabels,
  symptomAlert,
  type Medicine,
  type SearchMode,
} from "./domain/catalog";
import {
  downloadJson,
  loadPersonal,
  savePersonal,
  type PersonalData,
} from "./data/storage";
type Page = "home" | "compare" | "prices" | "library" | "settings";
const navigation = [
  { id: "home", label: "Início", icon: Home },
  { id: "compare", label: "Comparar", icon: Scale },
  { id: "prices", label: "Preços", icon: Tag },
  { id: "library", label: "Biblioteca", icon: BookOpen },
] as const;
const modes = [
  { id: "medicines", label: "Medicamentos", icon: Pill },
  { id: "symptoms", label: "Sintomas", icon: Stethoscope },
  { id: "ingredients", label: "Princípios ativos", icon: FlaskConical },
] as const;
export default function App() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [page, setPage] = useState<Page>(() => pageFromHash());
  const [personal, setPersonal] = useState(loadPersonal);
  const catalogState = useCatalog();
  const { catalog, references } = catalogState;
  const [resultLimit, setResultLimit] = useState(40);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [mode, setMode] = useState<SearchMode>("medicines");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Medicine | null>(null);
  const [notice, setNotice] = useState("");
  const [libraryTab, setLibraryTab] = useState("favorites");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteCategory, setNoteCategory] = useState("Geral");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      setDetail(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function navigate(next: Page) {
    setDetail(null);
    setPage(next);
    location.hash = next;
    window.scrollTo({ top: 0 });
  }
  function update(next: PersonalData) {
    try {
      savePersonal(next);
      setPersonal(next);
      return true;
    } catch {
      setNotice(
        "Não foi possível salvar. Verifique o espaço e as permissões de armazenamento do navegador.",
      );
      return false;
    }
  }
  function runSearch(value: string) {
    const q = value.trim().slice(0, 160);
    if (!q) {
      setSubmitted("");
      return;
    }
    setQuery(q);
    setSubmitted(q);
    setResultLimit(40);
    navigate("home");
    update({
      ...personal,
      history: [q, ...personal.history.filter((h) => h !== q)].slice(0, 30),
    });
  }
  function favorite(id: string) {
    update({
      ...personal,
      favorites: personal.favorites.includes(id)
        ? personal.favorites.filter((x) => x !== id)
        : [...personal.favorites, id],
    });
  }
  function toggleComparison(id: string) {
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length < 4
          ? [...s, id]
          : s,
    );
  }
  const index = useMemo(
    () => createSearchIndex(catalog, references),
    [catalog, references],
  );
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchIndex(index, submitted, mode),
    [index, submitted, mode],
  );
  const suggestions =
    query.trim() && query !== submitted
      ? searchIndex(index, deferredQuery, mode).slice(0, 5)
      : [];
  const favorites = catalog.filter((m) => personal.favorites.includes(m.id));
  const chosen = selected.flatMap((id) => {
    const medicine = catalog.find((m) => m.id === id);
    return medicine ? [medicine] : [];
  });
  const hasClinicalIndications = useMemo(
    () =>
      catalog.some(
        (m) =>
          m.facts.indications?.source.status === "validated" ||
          clinicalReferencesFor(m, references).some(
            (r) => r.facts.indications?.source.status === "validated",
          ),
      ),
    [catalog, references],
  );
  const symptomDataMissing =
    mode === "symptoms" && catalog.length > 0 && !hasClinicalIndications;
  const alert = symptomAlert(submitted);
  function medicineRow(m: Medicine) {
    return (
      <div className="medicine-row" key={m.id}>
        <button
          className="medicine-main"
          onClick={() => {
            setDetail(m);
            window.scrollTo({ top: 0 });
          }}
        >
          <span className="medicine-icon">
            <Pill size={19} />
          </span>
          <span>
            <strong>{m.name}</strong>
            {page === "home" &&
              submitted &&
              isApproximateMatch(m, submitted, mode, references) && (
                <span className="match-hint">
                  Correspondência aproximada · confira o princípio ativo
                </span>
              )}
            <small>
              {m.ingredient} · {m.drugClass}
            </small>
            {m.registration && (
              <span className="medicine-registration">
                {m.registration.holder} · Registro {m.registration.number}
              </span>
            )}
          </span>
          <ChevronRight size={17} />
        </button>
        <button
          className={`icon-button ${personal.favorites.includes(m.id) ? "is-favorite" : ""}`}
          aria-label={`${personal.favorites.includes(m.id) ? "Remover" : "Adicionar"} ${m.name} ${personal.favorites.includes(m.id) ? "dos" : "aos"} favoritos`}
          onClick={() => favorite(m.id)}
        >
          <Star
            size={18}
            fill={personal.favorites.includes(m.id) ? "currentColor" : "none"}
          />
        </button>
        <button
          className={`icon-button ${selected.includes(m.id) ? "selected" : ""}`}
          aria-label={`Comparar ${m.name}`}
          aria-pressed={selected.includes(m.id)}
          disabled={selected.length >= 4 && !selected.includes(m.id)}
          onClick={() => toggleComparison(m.id)}
        >
          {selected.includes(m.id) ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>
    );
  }
  function saveNote(e: FormEvent) {
    e.preventDefault();
    const note = {
      id: editingNote ?? crypto.randomUUID(),
      title: noteTitle.trim(),
      body: noteBody.trim(),
      category: noteCategory.trim() || "Geral",
      updatedAt: new Date().toISOString(),
    };
    if (!note.title || !note.body) return;
    if (
      !update({
        ...personal,
        notes: [note, ...personal.notes.filter((n) => n.id !== note.id)],
      })
    )
      return;
    setNoteTitle("");
    setNoteBody("");
    setEditingNote(null);
    setNotice("Anotação salva neste dispositivo.");
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("O arquivo deve ter no máximo 50 MB.");
      const raw = JSON.parse(await file.text());
      const imported = parseCatalog(raw);
      const importedReferences = parseClinicalReferences(
        raw.clinicalReferences ?? [],
      );
      await catalogState.importManual(imported, importedReferences);
      setNotice(
        `${imported.length} registros importados. A validação declarada no arquivo não substitui a conferência das fontes.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="app-shell">
      <ReadingProgress />
      {calculatorOpen && (
        <DoseConverter onClose={() => setCalculatorOpen(false)} />
      )}
      <aside className="sidebar">
        <a className="wordmark" href="#home" onClick={() => navigate("home")}>
          Doser<span className="wordmark-dot">.</span>
        </a>
        <div className="sidebar-label">CONSULTA PESSOAL</div>
        <nav aria-label="Navegação principal">
          {navigation.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {n.id === "compare" && selected.length > 0 && (
                <span className="count">{selected.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="status-dot" /> Armazenamento local
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
            <span>Dados e ajustes</span>
          </button>
          <span className="version">DOSER / VERSÃO 0.5</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a
            className="wordmark mobile-brand"
            href="#home"
            onClick={() => navigate("home")}
          >
            Doser<span className="wordmark-dot">.</span>
          </a>
          <span className="breadcrumb">
            Biblioteca farmacológica <span>/</span>{" "}
            {navigation.find((n) => n.id === page)?.label || "Dados e ajustes"}
          </span>
          <button
            className="text-button calculator-launch"
            aria-label="Calculadora"
            title="Calculadora"
            onClick={() => setCalculatorOpen(true)}
          >
            <Calculator size={18} />
            <span>Calculadora</span>
          </button>
          {catalogState.portable && !nativeAndroid && (
            <button
              className="text-button portable-save"
              title="Salvar HTML"
              aria-label="Salvar HTML"
              onClick={() => {
                try {
                  savePortableApplication();
                  setNotice(
                    "Solicitação enviada ao navegador. Confira a lista de downloads. A biblioteca pessoal deve ser exportada separadamente.",
                  );
                } catch (e) {
                  setNotice(
                    e instanceof Error
                      ? e.message
                      : "Não foi possível preparar o arquivo.",
                  );
                }
              }}
            >
              <Download size={18} />
              <span>Salvar HTML</span>
            </button>
          )}
          <button
            className="profile"
            aria-label="Abrir dados e ajustes"
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
          </button>
        </header>
        <main
          id="main-content"
          key={`${page}-${detail?.id ?? "index"}`}
          className={page === "home" && !detail ? "main home-main" : "main"}
        >
          {detail ? (
            <MedicineDetail
              onCalculate={() => setCalculatorOpen(true)}
              detail={detail}
              references={clinicalReferencesFor(detail, references)}
              saved={personal.favorites.includes(detail.id)}
              onBack={() => setDetail(null)}
              onFavorite={favorite}
              onCompare={(id) => {
                if (!selected.includes(id)) toggleComparison(id);
                setDetail(null);
                navigate("compare");
              }}
            />
          ) : (
            <>
              {page === "home" && (
                <>
                  <section className="search-hero">
                    <div className="hero-index">
                      <span className="tiny-line" /> CONSULTA / 01
                    </div>
                    <h1>Consulta farmacológica</h1>
                    <form
                      className="search-form"
                      role="search"
                      onPointerMove={(event) => {
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        event.currentTarget.style.setProperty(
                          "--pointer-x",
                          `${event.clientX - rect.left}px`,
                        );
                      }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        runSearch(query);
                      }}
                    >
                      <Search size={23} />
                      <input
                        ref={inputRef}
                        aria-label="Pesquisar no catálogo"
                        placeholder="Medicamento, sintoma ou princípio ativo"
                        value={query}
                        maxLength={160}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                      />
                      {query && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Limpar pesquisa"
                          onClick={() => {
                            setQuery("");
                            setSubmitted("");
                            inputRef.current?.focus();
                          }}
                        >
                          <X size={17} />
                        </button>
                      )}
                      <button
                        className="search-submit"
                        type="submit"
                        aria-label="Pesquisar"
                      >
                        <ArrowUpRight size={20} />
                      </button>
                      {suggestions.length > 0 && (
                        <div className="suggestions" aria-label="Sugestões">
                          {suggestions.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                runSearch(
                                  mode === "ingredients"
                                    ? m.ingredient
                                    : m.name,
                                )
                              }
                            >
                              <Search size={15} />
                              <span>
                                {m.name}
                                <small>{m.ingredient}</small>
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                        </div>
                      )}
                    </form>
                    <div className="search-modes" aria-label="Tipo de pesquisa">
                      {modes.map((m) => (
                        <button
                          key={m.id}
                          className={mode === m.id ? "active" : ""}
                          aria-pressed={mode === m.id}
                          onClick={() => setMode(m.id)}
                        >
                          <m.icon size={19} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {mode === "symptoms" && (
                      <p className="search-disclaimer">
                        Relaciona termos a indicações documentadas. Não realiza
                        diagnóstico nem define tratamento. Idade, duração,
                        intensidade e contexto clínico exigem avaliação
                        profissional.
                      </p>
                    )}
                  </section>
                  {submitted ? (
                    <section className="results section-block">
                      <div className="section-heading">
                        <h2>Resultados para “{submitted}”</h2>
                        <span className="meta">
                          {results.length} encontrados
                        </span>
                      </div>
                      {alert && (
                        <div className="info-strip warning">
                          <AlertCircle size={20} />
                          {alert}
                        </div>
                      )}
                      {results.length ? (
                        results.slice(0, resultLimit).map(medicineRow)
                      ) : (
                        <div className="empty-state">
                          <Search size={24} />
                          <h3>
                            {symptomDataMissing
                              ? "Indicações clínicas ainda não importadas"
                              : catalog.length
                                ? "Nenhum resultado encontrado"
                                : "Seu catálogo ainda está vazio"}
                          </h3>
                          <p>
                            {symptomDataMissing
                              ? "A base atual contém cadastros da Anvisa, mas não indicações terapêuticas. Pesquise pelo nome ou princípio ativo e consulte a bula."
                              : catalog.length
                                ? "Tente outro termo ou confira o tipo de pesquisa. A ausência de resultados não exclui uma condição clínica."
                                : "Atualize a base oficial ou importe registros com fontes para pesquisar neste dispositivo."}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => navigate("settings")}
                          >
                            Gerenciar catálogo <ChevronRight size={15} />
                          </button>
                        </div>
                      )}
                      {results.length > resultLimit && (
                        <button
                          className="secondary-button load-more"
                          onClick={() => setResultLimit((n) => n + 40)}
                        >
                          Mostrar mais resultados (
                          {results.length - resultLimit})
                        </button>
                      )}
                    </section>
                  ) : (
                    <>
                      <section className="section-block">
                        <div className="section-heading">
                          <h2>
                            <Clock3 size={20} />
                            Pesquisas recentes
                          </h2>
                          {personal.history.length > 0 && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setLibraryTab("history");
                                navigate("library");
                              }}
                            >
                              Ver histórico <ChevronRight size={16} />
                            </button>
                          )}
                        </div>
                        {personal.history.length ? (
                          personal.history.slice(0, 3).map((h) => (
                            <button
                              className="list-row"
                              key={h}
                              onClick={() => runSearch(h)}
                            >
                              <Search size={18} />
                              <span>{h}</span>
                              <ChevronRight size={17} />
                            </button>
                          ))
                        ) : (
                          <div className="quiet-empty">
                            <span>Nenhuma pesquisa recente.</span>
                            <small>Suas consultas aparecerão aqui.</small>
                          </div>
                        )}
                      </section>
                      <section className="section-block favorites-section">
                        <div className="section-heading">
                          <h2>
                            <Star size={20} />
                            Favoritos
                          </h2>
                          <button
                            className="text-button"
                            onClick={() => {
                              setLibraryTab("favorites");
                              navigate("library");
                            }}
                          >
                            Ver biblioteca <ChevronRight size={16} />
                          </button>
                        </div>
                        {favorites.length ? (
                          favorites.slice(0, 3).map(medicineRow)
                        ) : (
                          <div className="quiet-empty">
                            <span>Nenhum medicamento salvo.</span>
                            <small>
                              Use a estrela na ficha para guardar na biblioteca.
                            </small>
                          </div>
                        )}
                        <button
                          className="list-row"
                          onClick={() => {
                            setLibraryTab("notes");
                            navigate("library");
                          }}
                        >
                          <FileText size={19} />
                          <span>Minhas anotações</span>
                          {personal.notes.length > 0 && (
                            <span className="meta">
                              {personal.notes.length}
                            </span>
                          )}
                          <ChevronRight size={17} />
                        </button>
                      </section>
                    </>
                  )}
                  <section className="catalog-banner">
                    <div className="catalog-symbol">
                      <Database size={22} />
                    </div>
                    <div>
                      <h3>
                        {catalog.length
                          ? `${catalog.length} registros no catálogo local`
                          : "Catálogo local"}
                      </h3>
                      <p>
                        {catalog.length
                          ? "Dados disponíveis neste dispositivo."
                          : "Atualize a base da Anvisa ou importe dados documentados."}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("settings")}
                    >
                      {catalog.length ? "Gerenciar" : "Atualizar base"}
                      <ArrowUpRight size={16} />
                    </button>
                  </section>
                </>
              )}
              {page === "compare" && (
                <>
                  <PageHeading
                    index="02"
                    title="Comparar medicamentos"
                    subtitle="Compare informações documentadas lado a lado."
                  />
                  <div className="info-strip">
                    <Scale size={19} />
                    <span>
                      Indicações semelhantes não estabelecem equivalência ou
                      intercambialidade.
                    </span>
                  </div>
                  <div className="section-heading">
                    <h2>
                      Seleção <span className="meta">{selected.length}/4</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("home")}
                    >
                      Buscar medicamentos <Plus size={16} />
                    </button>
                  </div>
                  {catalog.length > 0 && (
                    <label className="field">
                      Adicionar medicamento
                      <select
                        value=""
                        onChange={(e) => toggleComparison(e.target.value)}
                      >
                        <option value="">Selecione até 4 registros</option>
                        {catalog
                          .filter((m) => !selected.includes(m.id))
                          .map((m) => (
                            <option
                              disabled={selected.length >= 4}
                              key={m.id}
                              value={m.id}
                            >
                              {m.name} · {m.ingredient}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {chosen.length ? (
                    <>
                      <div className="comparison-chips">
                        {chosen.map((m) => (
                          <button
                            className="chip"
                            key={m.id}
                            onClick={() => toggleComparison(m.id)}
                          >
                            {m.name}
                            <X size={14} />
                          </button>
                        ))}
                      </div>
                      {chosen.length >= 2 ? (
                        <>
                          <p className="comparison-notice">
                            {compare(chosen[0], chosen[1])}
                            {chosen.length > 2 &&
                              " A observação considera os dois primeiros registros; cada par exige conferência própria."}
                          </p>
                          <div className="table-scroll">
                            <table>
                              <caption className="sr-only">
                                Comparação dos medicamentos selecionados
                              </caption>
                              <thead>
                                <tr>
                                  <th>Informação</th>
                                  {chosen.map((m) => (
                                    <th key={m.id}>{m.name}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <th>Princípio ativo</th>
                                  {chosen.map((m) => (
                                    <td key={m.id}>{m.ingredient}</td>
                                  ))}
                                </tr>
                                <tr>
                                  <th>Classe</th>
                                  {chosen.map((m) => (
                                    <td key={m.id}>{m.drugClass}</td>
                                  ))}
                                </tr>
                                <tr>
                                  <th>Apresentações</th>
                                  {chosen.map((m) => (
                                    <td key={m.id}>
                                      {m.presentations.join("; ") ||
                                        "Não informado"}
                                    </td>
                                  ))}
                                </tr>
                                {(
                                  [
                                    "indications",
                                    "dynamics",
                                    "contraindications",
                                    "adverse",
                                    "interactions",
                                  ] as const
                                ).map((key) => (
                                  <tr key={key}>
                                    <th>{sectionLabels[key]}</th>
                                    {chosen.map((m) => (
                                      <td key={m.id}>
                                        <ComparisonFact
                                          medicine={m}
                                          section={key}
                                          references={references}
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                <tr>
                                  <th>Preços</th>
                                  {chosen.map((m) => (
                                    <td key={m.id}>Não consultados</td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <button
                            className="primary-button"
                            onClick={() => {
                              const saved = update({
                                ...personal,
                                comparisons: [
                                  {
                                    id: crypto.randomUUID(),
                                    ids: selected,
                                    createdAt: new Date().toISOString(),
                                  },
                                  ...personal.comparisons,
                                ],
                              });
                              if (saved)
                                setNotice("Comparação salva na biblioteca.");
                            }}
                          >
                            Salvar comparação
                          </button>
                        </>
                      ) : (
                        <p className="muted">
                          Selecione mais um medicamento para comparar.
                        </p>
                      )}
                    </>
                  ) : (
                    <Empty
                      icon={<Scale size={29} />}
                      title="Nenhum medicamento selecionado"
                      text="Adicione de dois a quatro medicamentos do seu catálogo para comparar."
                      action="Pesquisar medicamentos"
                      onAction={() => navigate("home")}
                    />
                  )}
                </>
              )}
              {page === "prices" && <PricesPage onNotice={setNotice} />}
              {page === "library" && (
                <>
                  <PageHeading
                    index="04"
                    title="Biblioteca"
                    subtitle="Seus registros, neste dispositivo."
                  />
                  <div className="tabs" aria-label="Seções da biblioteca">
                    {[
                      ["favorites", "Favoritos"],
                      ["notes", "Anotações"],
                      ["history", "Histórico"],
                      ["comparisons", "Comparações"],
                    ].map(([id, label]) => (
                      <button
                        className={libraryTab === id ? "active" : ""}
                        aria-pressed={libraryTab === id}
                        key={id}
                        onClick={() => setLibraryTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {libraryTab === "favorites" &&
                    (favorites.length ? (
                      favorites.map(medicineRow)
                    ) : (
                      <Empty
                        icon={<Star size={28} />}
                        title="Nenhum favorito"
                        text="Salve medicamentos usando a estrela na ficha."
                        action="Ir para pesquisa"
                        onAction={() => navigate("home")}
                      />
                    ))}
                  {libraryTab === "history" && (
                    <>
                      {personal.history.length > 0 && (
                        <button
                          className="text-button danger"
                          onClick={() => update({ ...personal, history: [] })}
                        >
                          <Trash2 size={15} /> Limpar histórico
                        </button>
                      )}
                      {personal.history.length ? (
                        personal.history.map((h) => (
                          <button
                            className="list-row"
                            key={h}
                            onClick={() => runSearch(h)}
                          >
                            <Clock3 size={17} />
                            <span>{h}</span>
                            <ChevronRight size={17} />
                          </button>
                        ))
                      ) : (
                        <Empty
                          icon={<Clock3 size={28} />}
                          title="Histórico vazio"
                          text="As pesquisas realizadas ficam salvas aqui."
                        />
                      )}
                    </>
                  )}
                  {libraryTab === "notes" && (
                    <div className="notes-layout">
                      <form className="note-form" onSubmit={saveNote}>
                        <h2>
                          {editingNote ? "Editar anotação" : "Nova anotação"}
                        </h2>
                        <label className="field">
                          Título
                          <input
                            required
                            value={noteTitle}
                            maxLength={120}
                            onChange={(e) => setNoteTitle(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Categoria
                          <input
                            required
                            value={noteCategory}
                            maxLength={60}
                            onChange={(e) => setNoteCategory(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Anotação acadêmica
                          <textarea
                            required
                            rows={6}
                            maxLength={20000}
                            value={noteBody}
                            onChange={(e) => setNoteBody(e.target.value)}
                          />
                        </label>
                        <p className="small-note">
                          Conteúdo pessoal, separado das informações
                          documentadas. Não registre dados identificáveis de
                          pacientes.
                        </p>
                        <button className="primary-button">
                          {editingNote
                            ? "Salvar alterações"
                            : "Salvar anotação"}
                        </button>
                        {editingNote && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setEditingNote(null);
                              setNoteTitle("");
                              setNoteBody("");
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </form>
                      <div>
                        {personal.notes.length ? (
                          personal.notes.map((n) => (
                            <article className="note" key={n.id}>
                              <span className="eyebrow">
                                {n.category} · PESSOAL
                              </span>
                              <h3>{n.title}</h3>
                              <p>{n.body}</p>
                              <small>
                                {new Date(n.updatedAt).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </small>
                              <div className="note-actions">
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setEditingNote(n.id);
                                    setNoteTitle(n.title);
                                    setNoteBody(n.body);
                                    setNoteCategory(n.category);
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  className="icon-button danger"
                                  aria-label={`Excluir anotação ${n.title}`}
                                  onClick={() =>
                                    update({
                                      ...personal,
                                      notes: personal.notes.filter(
                                        (x) => x.id !== n.id,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="quiet-empty">Nenhuma anotação salva.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {libraryTab === "comparisons" &&
                    (personal.comparisons.length ? (
                      personal.comparisons.map((c) => (
                        <div className="saved-comparison" key={c.id}>
                          <button
                            className="medicine-main"
                            onClick={() => {
                              setSelected(
                                c.ids.filter((id) =>
                                  catalog.some((m) => m.id === id),
                                ),
                              );
                              navigate("compare");
                            }}
                          >
                            <Scale size={20} />
                            <span>
                              <strong>
                                {c.ids
                                  .map(
                                    (id) =>
                                      catalog.find((m) => m.id === id)?.name ||
                                      "Registro indisponível",
                                  )
                                  .join(" × ")}
                              </strong>
                              <small>
                                {new Date(c.createdAt).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label="Excluir comparação"
                            onClick={() =>
                              update({
                                ...personal,
                                comparisons: personal.comparisons.filter(
                                  (x) => x.id !== c.id,
                                ),
                              })
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <Empty
                        icon={<Scale size={28} />}
                        title="Nenhuma comparação salva"
                        text="As comparações que você salvar ficam disponíveis aqui."
                      />
                    ))}
                </>
              )}
              {page === "settings" && (
                <>
                  <PageHeading
                    index="05"
                    title="Dados e ajustes"
                    subtitle="Catálogo, fontes e armazenamento local."
                  />
                  <CatalogUpdates
                    portable={catalogState.portable}
                    ready={catalogState.ready}
                    updating={catalogState.updating}
                    automatic={catalogState.preferences.automatic}
                    onAutomatic={catalogState.setAutomatic}
                    onUpdate={() => void catalogState.updateNow()}
                    error={
                      catalogState.error || catalogState.status.lastError || ""
                    }
                    lastSuccess={catalogState.lastSuccess}
                    officialCount={catalogState.officialCount}
                    status={catalogState.status}
                  />
                  <section className="settings-section">
                    <div className="section-heading">
                      <h2>
                        <Database size={20} />
                        Catálogo de medicamentos
                      </h2>
                      <span className="meta">{catalog.length} registros</span>
                    </div>
                    <p>
                      Importe um arquivo JSON no formato Doser. Cada informação
                      exige fonte, URL HTTPS, data de verificação, versão e
                      status. A importação verifica a estrutura; a conferência
                      científica é responsabilidade de quem prepara os dados.
                    </p>
                    <div className="button-row">
                      <label
                        className={`primary-button file-button ${importing || !catalogState.ready ? "disabled" : ""}`}
                      >
                        <Upload size={17} />
                        {importing ? "Importando…" : "Importar catálogo"}
                        <input
                          type="file"
                          accept=".json,application/json"
                          disabled={importing || !catalogState.ready}
                          onChange={(e) => {
                            void importFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          downloadJson(
                            {
                              version: 1,
                              medicines: catalog,
                              clinicalReferences: references,
                            },
                            "doser-catalogo.json",
                          )
                        }
                      >
                        <Download size={17} />
                        Exportar catálogo
                      </button>
                    </div>
                    <p className="small-note">
                      Até 50 MB por arquivo e 100.000 registros. IDs existentes
                      são atualizados. Nenhum catálogo de demonstração é
                      incluído. O formato está documentado em docs/catalogo.md.
                    </p>
                  </section>
                  <section className="settings-section">
                    <h2>Fontes para consulta</h2>
                    <p>
                      Links oficiais e científicos. A atualização cadastral usa
                      o arquivo aberto da Anvisa. Bulas e literatura continuam
                      como consultas externas.
                    </p>
                    {sources.map(([title, description, url]) => (
                      <div className="external-row" key={title}>
                        <div>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </div>
                        <External href={url}>Consultar</External>
                      </div>
                    ))}
                  </section>
                  <section className="settings-section">
                    <h2>Dados pessoais</h2>
                    <p>
                      Favoritos, histórico, anotações e comparações são
                      armazenados neste navegador. Não há conta, sincronização
                      ou envio para um servidor. Limpar os dados do navegador
                      pode apagar sua biblioteca. Este armazenamento não possui
                      criptografia própria.
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        downloadJson(personal, "doser-biblioteca.json")
                      }
                    >
                      <Download size={17} />
                      Exportar biblioteca
                    </button>
                    <p className="small-note">
                      A exportação é um arquivo de backup. Restauração da
                      biblioteca e armazenamento SQLite estão previstos para a
                      próxima etapa.
                    </p>
                  </section>
                  <section className="settings-section">
                    <h2>Sobre esta versão</h2>
                    <p>
                      Doser 0.3 · Consulta local e atualização cadastral. Sem
                      diagnóstico, prescrição ou validação regulatória
                      automática. Empacotamento Windows e Android ainda não
                      disponível.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="footer">
          <span>
            Doser<span className="footer-dot"> / </span>Consulta farmacológica
          </span>
          <span>
            Uso acadêmico e pessoal <span className="footer-dot">·</span> Dados
            locais
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            aria-current={page === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {selected.length >= 2 && page === "home" && (
        <button className="compare-float" onClick={() => navigate("compare")}>
          <Scale size={18} />
          Comparar ({selected.length})<ChevronRight size={16} />
        </button>
      )}
      {notice && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function pageFromHash(): Page {
  const hash = location.hash.slice(1);
  return ["home", "compare", "prices", "library", "settings"].includes(hash)
    ? (hash as Page)
    : "home";
}
