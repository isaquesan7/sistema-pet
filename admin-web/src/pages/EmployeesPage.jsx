import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CalendarClock,
  Edit3,
  Plus,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";
import { companyTypeLabel, formatCurrency, formatDate, formatDocument, formatPhone } from "../lib/formatters.js";

const DAYS = [
  [0, "Domingo"],
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
];

const emptyEmployee = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  matricula: "",
  funcaoId: "",
  dataAdmissao: "",
  dataDemissao: "",
  salarioBase: "",
  status: "ATIVO",
  observacoes: "",
  empresas: [],
};

const emptyFunction = { nome: "", descricao: "", ativo: true };

function normalizeEmployee(employee) {
  if (!employee) return { ...emptyEmployee, empresas: [] };
  return {
    nome: employee.nome || "",
    cpf: employee.cpf || "",
    email: employee.email || "",
    telefone: employee.telefone || "",
    matricula: employee.matricula || "",
    funcaoId: employee.funcaoId || employee.funcao?.id || "",
    dataAdmissao: employee.dataAdmissao ? String(employee.dataAdmissao).slice(0, 10) : "",
    dataDemissao: employee.dataDemissao ? String(employee.dataDemissao).slice(0, 10) : "",
    salarioBase: employee.salarioBase ?? "",
    status: employee.status || "ATIVO",
    observacoes: employee.observacoes || "",
    empresas: (employee.empresas || []).map((link) => ({
      empresaId: link.empresaId || link.empresa?.id,
      principal: Boolean(link.principal),
    })),
  };
}

function normalizeJourney(employee, companyId) {
  const existing = new Map(
    (employee?.jornadas || [])
      .filter((journey) => journey.empresaId === companyId)
      .map((journey) => [journey.diaSemana, journey])
  );

  return DAYS.map(([diaSemana]) => {
    const item = existing.get(diaSemana);
    return {
      empresaId: companyId,
      diaSemana,
      entradaPrevista: item?.entradaPrevista || "09:00",
      saidaPrevista: item?.saidaPrevista || "18:00",
      inicioIntervalo: item?.inicioIntervalo || "12:00",
      fimIntervalo: item?.fimIntervalo || "13:00",
      toleranciaMinutos: item?.toleranciaMinutos ?? 10,
      ativo: item?.ativo ?? (diaSemana >= 1 && diaSemana <= 6),
    };
  });
}

async function loadEmployees(search) {
  const { data } = await api.get("/funcionarios", { params: { busca: search || undefined } });
  return data.dados || [];
}

async function loadFunctions() {
  const { data } = await api.get("/funcionarios/funcoes");
  return data.dados || [];
}

export default function EmployeesPage() {
  const { hasPermission, user, selectedOrganization } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [functionModal, setFunctionModal] = useState(false);
  const [journeyModal, setJourneyModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingFunction, setEditingFunction] = useState(null);
  const [form, setForm] = useState(() => normalizeEmployee(null));
  const [functionForm, setFunctionForm] = useState(emptyFunction);
  const [journeyEmployee, setJourneyEmployee] = useState(null);
  const [journeyCompanyId, setJourneyCompanyId] = useState("");
  const [journeys, setJourneys] = useState([]);
  const [formError, setFormError] = useState("");
  const [functionError, setFunctionError] = useState("");
  const [journeyError, setJourneyError] = useState("");

  const employeesQuery = useQuery({
    queryKey: ["employees", selectedOrganization?.id, deferredSearch],
    queryFn: () => loadEmployees(deferredSearch),
  });

  const functionsQuery = useQuery({
    queryKey: ["employee-functions", selectedOrganization?.id],
    queryFn: loadFunctions,
  });

  const employees = employeesQuery.data || [];
  const functions = functionsQuery.data || [];
  const canManage = hasPermission("funcionarios.gerenciar");
  const companies = useMemo(
    () => (user?.empresas || []).filter((company) => company.organizacaoId === selectedOrganization?.id),
    [user, selectedOrganization?.id]
  );

  const summary = useMemo(() => ({
    total: employees.length,
    active: employees.filter((employee) => employee.status === "ATIVO").length,
    away: employees.filter((employee) => ["AFASTADO", "FERIAS"].includes(employee.status)).length,
    functions: functions.filter((item) => item.ativo !== false).length,
  }), [employees, functions]);

  const employeeMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingEmployee?.id) return (await api.patch(`/funcionarios/${editingEmployee.id}`, payload)).data;
      return (await api.post("/funcionarios", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      closeEmployee();
    },
    onError: (error) => setFormError(getApiErrorMessage(error, "Não foi possível salvar o funcionário.")),
  });

  const functionMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingFunction?.id) return (await api.patch(`/funcionarios/funcoes/${editingFunction.id}`, payload)).data;
      return (await api.post("/funcionarios/funcoes", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-functions"] });
      closeFunction();
    },
    onError: (error) => setFunctionError(getApiErrorMessage(error, "Não foi possível salvar a função.")),
  });

  const journeyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        jornadas: journeys.map((journey) => ({
          ...journey,
          inicioIntervalo: journey.inicioIntervalo || null,
          fimIntervalo: journey.fimIntervalo || null,
          toleranciaMinutos: Number(journey.toleranciaMinutos || 0),
        })),
      };
      return (await api.put(`/funcionarios/${journeyEmployee.id}/jornadas`, payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setJourneyModal(false);
      setJourneyEmployee(null);
      setJourneys([]);
    },
    onError: (error) => setJourneyError(getApiErrorMessage(error, "Não foi possível salvar a jornada.")),
  });

  function openCreate() {
    setEditingEmployee(null);
    setForm(normalizeEmployee(null));
    setFormError("");
    setEmployeeModal(true);
  }

  function openEdit(employee) {
    if (!canManage) return;
    setEditingEmployee(employee);
    setForm(normalizeEmployee(employee));
    setFormError("");
    setEmployeeModal(true);
  }

  function closeEmployee() {
    if (employeeMutation.isPending) return;
    setEmployeeModal(false);
    setEditingEmployee(null);
    setForm(normalizeEmployee(null));
    setFormError("");
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleCompany(companyId, checked) {
    setForm((current) => {
      const existing = current.empresas || [];
      if (!checked) {
        const next = existing.filter((item) => item.empresaId !== companyId);
        if (next.length && !next.some((item) => item.principal)) next[0] = { ...next[0], principal: true };
        return { ...current, empresas: next };
      }
      if (existing.some((item) => item.empresaId === companyId)) return current;
      return {
        ...current,
        empresas: [...existing, { empresaId: companyId, principal: existing.length === 0 }],
      };
    });
  }

  function setPrincipal(companyId) {
    setForm((current) => ({
      ...current,
      empresas: (current.empresas || []).map((item) => ({ ...item, principal: item.empresaId === companyId })),
    }));
  }

  function submitEmployee(event) {
    event.preventDefault();
    setFormError("");
    if (!form.nome.trim()) return setFormError("Informe o nome do funcionário.");
    if (!form.empresas.length) return setFormError("Selecione pelo menos uma empresa/CNPJ para o funcionário.");

    employeeMutation.mutate({
      nome: form.nome.trim(),
      cpf: form.cpf || null,
      email: form.email || null,
      telefone: form.telefone || null,
      matricula: form.matricula || null,
      funcaoId: form.funcaoId || null,
      dataAdmissao: form.dataAdmissao || null,
      dataDemissao: form.dataDemissao || null,
      salarioBase: form.salarioBase === "" ? null : Number(form.salarioBase),
      status: form.status,
      observacoes: form.observacoes || null,
      empresas: form.empresas,
    });
  }

  function openFunctions(item = null) {
    setEditingFunction(item);
    setFunctionForm(item ? { nome: item.nome || "", descricao: item.descricao || "", ativo: item.ativo !== false } : { ...emptyFunction });
    setFunctionError("");
    setFunctionModal(true);
  }

  function closeFunction() {
    if (functionMutation.isPending) return;
    setFunctionModal(false);
    setEditingFunction(null);
    setFunctionForm({ ...emptyFunction });
    setFunctionError("");
  }

  function submitFunction(event) {
    event.preventDefault();
    if (!functionForm.nome.trim()) return setFunctionError("Informe o nome da função.");
    functionMutation.mutate({
      nome: functionForm.nome.trim(),
      descricao: functionForm.descricao || null,
      ativo: functionForm.ativo,
    });
  }

  function openJourney(employee) {
    const employeeCompanies = (employee.empresas || []).filter((link) => link.ativo !== false);
    const firstCompanyId = employeeCompanies[0]?.empresaId || employeeCompanies[0]?.empresa?.id || "";
    setJourneyEmployee(employee);
    setJourneyCompanyId(firstCompanyId);
    setJourneys(firstCompanyId ? normalizeJourney(employee, firstCompanyId) : []);
    setJourneyError("");
    setJourneyModal(true);
  }

  function changeJourneyCompany(companyId) {
    setJourneyCompanyId(companyId);
    setJourneys(normalizeJourney(journeyEmployee, companyId));
  }

  function updateJourney(dayIndex, field, value) {
    setJourneys((current) => current.map((item, index) => index === dayIndex ? { ...item, [field]: value } : item));
  }

  function statusLabel(status) {
    return { ATIVO: "Ativo", AFASTADO: "Afastado", FERIAS: "Férias", DESLIGADO: "Desligado" }[status] || status;
  }

  function statusClass(status) {
    return status === "ATIVO" ? "badge--success" : status === "DESLIGADO" ? "badge--muted" : "badge--warning";
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Equipe e RH</span>
          <h1>Funcionários</h1>
          <p>Cadastre sua equipe, organize funções, empresas e jornadas de trabalho.</p>
        </div>
        <div className="page-heading-actions">
          <button className="secondary-button" type="button" onClick={() => openFunctions()} disabled={!canManage}>
            <BriefcaseBusiness size={17} /> Funções
          </button>
          <button className="primary-button" type="button" onClick={openCreate} disabled={!canManage}>
            <Plus size={18} /> Novo funcionário
          </button>
        </div>
      </section>

      <section className="employee-summary-grid">
        <article className="employee-summary-card"><span><UsersRound size={19} /></span><div><small>Equipe cadastrada</small><strong>{summary.total}</strong><em>funcionários</em></div></article>
        <article className="employee-summary-card"><span><UserRound size={19} /></span><div><small>Ativos</small><strong>{summary.active}</strong><em>em atividade</em></div></article>
        <article className="employee-summary-card"><span><CalendarClock size={19} /></span><div><small>Afastados / férias</small><strong>{summary.away}</strong><em>temporariamente</em></div></article>
        <article className="employee-summary-card"><span><BriefcaseBusiness size={19} /></span><div><small>Funções</small><strong>{summary.functions}</strong><em>ativas</em></div></article>
      </section>

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, CPF ou matrícula..." />
          </label>
          <span className="toolbar__count">{employees.length} funcionários</span>
        </div>

        {employeesQuery.isLoading ? (
          <div className="loading-state">Carregando equipe...</div>
        ) : employeesQuery.isError ? (
          <div className="empty-state"><UsersRound size={30} /><strong>Não foi possível carregar os funcionários</strong><p>{getApiErrorMessage(employeesQuery.error)}</p></div>
        ) : employees.length === 0 ? (
          <div className="empty-state"><UsersRound size={30} /><strong>Nenhum funcionário cadastrado</strong><p>Cadastre a equipe para começar a usar jornadas e ponto.</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Funcionário</th><th>Função</th><th>Empresa(s)</th><th>Admissão</th><th>Status</th><th className="table-actions-col">Ações</th></tr></thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td><div className="person-cell"><span className="avatar-soft">{employee.nome.slice(0, 1).toUpperCase()}</span><div><strong>{employee.nome}</strong><small>{employee.matricula ? `Matrícula ${employee.matricula}` : formatDocument(employee.cpf)}</small></div></div></td>
                    <td><span className="table-main-text">{employee.funcao?.nome || "Sem função"}</span><small className="table-subtext">{employee.usuario ? `Login: ${employee.usuario.email}` : "Sem acesso ao sistema"}</small></td>
                    <td><div className="company-chip-list">{(employee.empresas || []).map((link) => <span key={link.empresaId} className="company-chip">{link.empresa?.nomeFantasia}{link.principal ? " • principal" : ""}</span>)}</div></td>
                    <td><span className="table-main-text">{formatDate(employee.dataAdmissao)}</span><small className="table-subtext">{employee.telefone ? formatPhone(employee.telefone) : "Sem telefone"}</small></td>
                    <td><span className={`badge ${statusClass(employee.status)}`}>{statusLabel(employee.status)}</span></td>
                    <td className="table-actions-col"><div className="table-actions"><button className="icon-button table-action" type="button" onClick={() => openJourney(employee)} title="Jornada" disabled={!canManage}><CalendarClock size={15} /></button><button className="icon-button table-action" type="button" onClick={() => openEdit(employee)} title="Editar" disabled={!canManage}><Edit3 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={employeeModal} title={editingEmployee ? "Editar funcionário" : "Novo funcionário"} onClose={closeEmployee} size="lg">
        <form onSubmit={submitEmployee}>
          <div className="modal-body form-stack">
            <InlineNotice type="error">{formError}</InlineNotice>
            <div className="form-section-title"><strong>Dados do funcionário</strong><span>Informações trabalhistas e de contato.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="Nome" span={2}><input value={form.nome} onChange={(e) => updateField("nome", e.target.value)} autoFocus /></FormField>
              <FormField label="Status"><select value={form.status} onChange={(e) => updateField("status", e.target.value)}><option value="ATIVO">Ativo</option><option value="AFASTADO">Afastado</option><option value="FERIAS">Férias</option><option value="DESLIGADO">Desligado</option></select></FormField>
              <FormField label="CPF"><input value={form.cpf} onChange={(e) => updateField("cpf", e.target.value)} /></FormField>
              <FormField label="Matrícula"><input value={form.matricula} onChange={(e) => updateField("matricula", e.target.value)} /></FormField>
              <FormField label="Função"><select value={form.funcaoId} onChange={(e) => updateField("funcaoId", e.target.value)}><option value="">Sem função</option>{functions.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
              <FormField label="E-mail"><input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} /></FormField>
              <FormField label="Telefone"><input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} /></FormField>
              <FormField label="Salário base"><input type="number" min="0" step="0.01" value={form.salarioBase} onChange={(e) => updateField("salarioBase", e.target.value)} /></FormField>
              <FormField label="Admissão"><input type="date" value={form.dataAdmissao} onChange={(e) => updateField("dataAdmissao", e.target.value)} /></FormField>
              <FormField label="Demissão"><input type="date" value={form.dataDemissao} onChange={(e) => updateField("dataDemissao", e.target.value)} /></FormField>
            </div>

            <div className="form-section-title"><strong>Empresas / CNPJs</strong><span>O funcionário pode atuar em mais de uma empresa da organização.</span></div>
            <div className="employee-company-grid">
              {companies.map((company) => {
                const selected = form.empresas.some((item) => item.empresaId === company.id);
                const principal = form.empresas.some((item) => item.empresaId === company.id && item.principal);
                return <div key={company.id} className={`employee-company-card ${selected ? "is-selected" : ""}`}><label><input type="checkbox" checked={selected} onChange={(e) => toggleCompany(company.id, e.target.checked)} /><span><strong>{company.nomeFantasia}</strong><small>{companyTypeLabel(company.tipo)}</small></span></label>{selected && <label className="principal-radio"><input type="radio" name="empresaPrincipal" checked={principal} onChange={() => setPrincipal(company.id)} /> Principal</label>}</div>;
              })}
            </div>

            <FormField label="Observações"><textarea rows="3" value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} /></FormField>
            {editingEmployee?.usuario && <InlineNotice type="info">Este funcionário possui acesso ao BichOne com {editingEmployee.usuario.email}. O vínculo de login é administrado separadamente das informações trabalhistas.</InlineNotice>}
          </div>
          <div className="modal-footer"><button className="text-button" type="button" onClick={closeEmployee}>Cancelar</button><button className="primary-button" disabled={employeeMutation.isPending}>{employeeMutation.isPending ? "Salvando..." : "Salvar"}</button></div>
        </form>
      </Modal>

      <Modal open={functionModal} title={editingFunction ? "Editar função" : "Nova função"} onClose={closeFunction}>
        <form onSubmit={submitFunction}>
          <div className="modal-body form-stack">
            <InlineNotice type="error">{functionError}</InlineNotice>
            {!editingFunction && functions.length > 0 && <div className="function-list-mini">{functions.map((item) => <button type="button" key={item.id} onClick={() => openFunctions(item)}><span><strong>{item.nome}</strong><small>{item.descricao || "Sem descrição"}</small></span><span className={`badge ${item.ativo ? "badge--success" : "badge--muted"}`}>{item.ativo ? "Ativa" : "Inativa"}</span></button>)}</div>}
            <FormField label="Nome da função"><input value={functionForm.nome} onChange={(e) => setFunctionForm((current) => ({ ...current, nome: e.target.value }))} autoFocus /></FormField>
            <FormField label="Descrição"><textarea rows="3" value={functionForm.descricao} onChange={(e) => setFunctionForm((current) => ({ ...current, descricao: e.target.value }))} /></FormField>
            <label className="check-card check-card--compact"><input type="checkbox" checked={functionForm.ativo} onChange={(e) => setFunctionForm((current) => ({ ...current, ativo: e.target.checked }))} /><span><strong>Função ativa</strong><small>Disponível para novos funcionários.</small></span></label>
          </div>
          <div className="modal-footer">{editingFunction && <button className="text-button" type="button" onClick={() => openFunctions()}>Voltar à lista</button>}<button className="text-button" type="button" onClick={closeFunction}>Cancelar</button><button className="primary-button" disabled={functionMutation.isPending}>{functionMutation.isPending ? "Salvando..." : "Salvar"}</button></div>
        </form>
      </Modal>

      <Modal open={journeyModal} title={journeyEmployee ? `Jornada — ${journeyEmployee.nome}` : "Jornada"} onClose={() => setJourneyModal(false)} size="lg">
        <form onSubmit={(event) => { event.preventDefault(); journeyMutation.mutate(); }}>
          <div className="modal-body form-stack">
            <InlineNotice type="error">{journeyError}</InlineNotice>
            <div className="journey-toolbar"><div><strong>Escala semanal</strong><span>Defina os horários previstos para cada CNPJ.</span></div><select value={journeyCompanyId} onChange={(e) => changeJourneyCompany(e.target.value)}>{(journeyEmployee?.empresas || []).map((link) => <option key={link.empresaId || link.empresa?.id} value={link.empresaId || link.empresa?.id}>{link.empresa?.nomeFantasia}</option>)}</select></div>
            {journeys.length ? <div className="journey-list">{journeys.map((journey, index) => <div key={journey.diaSemana} className={`journey-row ${journey.ativo ? "is-active" : ""}`}><label className="journey-day"><input type="checkbox" checked={journey.ativo} onChange={(e) => updateJourney(index, "ativo", e.target.checked)} /><span>{DAYS.find(([day]) => day === journey.diaSemana)?.[1]}</span></label><label><span>Entrada</span><input type="time" value={journey.entradaPrevista} disabled={!journey.ativo} onChange={(e) => updateJourney(index, "entradaPrevista", e.target.value)} /></label><label><span>Início pausa</span><input type="time" value={journey.inicioIntervalo || ""} disabled={!journey.ativo} onChange={(e) => updateJourney(index, "inicioIntervalo", e.target.value)} /></label><label><span>Fim pausa</span><input type="time" value={journey.fimIntervalo || ""} disabled={!journey.ativo} onChange={(e) => updateJourney(index, "fimIntervalo", e.target.value)} /></label><label><span>Saída</span><input type="time" value={journey.saidaPrevista} disabled={!journey.ativo} onChange={(e) => updateJourney(index, "saidaPrevista", e.target.value)} /></label><label><span>Tolerância</span><input type="number" min="0" max="120" value={journey.toleranciaMinutos} disabled={!journey.ativo} onChange={(e) => updateJourney(index, "toleranciaMinutos", e.target.value)} /></label></div>)}</div> : <InlineNotice type="info">Vincule o funcionário a uma empresa antes de cadastrar a jornada.</InlineNotice>}
          </div>
          <div className="modal-footer"><button className="text-button" type="button" onClick={() => setJourneyModal(false)}>Cancelar</button><button className="primary-button" disabled={!journeys.length || journeyMutation.isPending}>{journeyMutation.isPending ? "Salvando..." : "Salvar jornada"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
