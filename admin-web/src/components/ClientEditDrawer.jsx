import {useState} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import Modal from "../components/Modal.jsx";
import api,{getApiErrorMessage} from "../lib/api.js";
/** Edit a tutor in-place instead of navigating away from the detail screen. */
export default function ClientEditDrawer({client,onClose,onSaved}){
 const qc=useQueryClient();
 const [form,setForm]=useState(()=>Object.fromEntries(["nome","cpfCnpj","telefone","whatsapp","email","cep","logradouro","numero","complemento","bairro","cidade","estado","observacoes"].map(k=>[k,client?.[k]||""])));
 const [error,setError]=useState("");
 const mutation=useMutation({mutationFn:async()=>api.patch(`/clientes/${client.id}`,Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.trim()||null]))),onSuccess:async()=>{await qc.invalidateQueries({queryKey:["client-detail",client.id]});await qc.invalidateQueries({queryKey:["clients"]});onSaved?.();},onError:e=>setError(getApiErrorMessage(e))});
 const fields=[["nome","Nome completo"],["cpfCnpj","CPF/CNPJ"],["whatsapp","WhatsApp"],["telefone","Telefone"],["email","E-mail"],["cep","CEP"],["logradouro","Logradouro"],["numero","Número"],["complemento","Complemento"],["bairro","Bairro"],["cidade","Cidade"],["estado","UF"],["observacoes","Observações"]];
 return <Modal drawer open title="Editar dados do cliente" subtitle={client.nome} onClose={onClose} footer={<><button className="ghost-button" onClick={onClose}>Cancelar</button><button form="pv-edit-client-form" type="submit" className="primary-button" disabled={mutation.isPending}>Salvar alterações</button></>}>
  <form id="pv-edit-client-form" className="pv-pet-form" onSubmit={e=>{e.preventDefault();mutation.mutate();}}>
   {error&&<div className="alert alert--error">{error}</div>}
   {fields.map(([key,label])=><label key={key}>{label}{key==="observacoes"?<textarea className="form-control" rows={3} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>:<input required={key==="nome"} className="form-control" type={key==="email"?"email":"text"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>}</label>)}
  </form>
 </Modal>;
}
