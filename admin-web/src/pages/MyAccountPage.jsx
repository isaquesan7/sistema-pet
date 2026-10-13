/**
 * Self-service account settings for any authenticated PointVet staff member.
 * Credentials are never displayed; sensitive updates require reauthentication.
 */
import {useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {Camera,LockKeyhole,UserRound,ShieldCheck} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {useAuth} from "../context/AuthContext.jsx";

export default function MyAccountPage(){
 const {user,logout,refreshSession}=useAuth();
 const navigate=useNavigate();
 const [tab,setTab]=useState("perfil"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const [profile,setProfile]=useState({nome:"",nomeExibicao:"",email:"",telefone:"",fotoUrl:"",senhaAtual:""});
 const [password,setPassword]=useState({senhaAtual:"",novaSenha:"",confirmarSenha:""});
 useEffect(()=>{let alive=true;api.get("/auth/me/perfil").then(({data})=>{if(alive){setProfile({...data.usuario,senhaAtual:""});setLoading(false);}}).catch(e=>{if(alive){setError(getApiErrorMessage(e));setLoading(false);}});return()=>{alive=false;};},[]);
 function update(k,v){setProfile(p=>({...p,[k]:v}));}
 async function saveProfile(event){
  event.preventDefault();setError("");setMessage("");setBusy(true);
  try{
   const {data}=await api.patch("/auth/me/perfil",{
    nome:profile.nome,nomeExibicao:profile.nomeExibicao||null,email:profile.email,telefone:profile.telefone||null,fotoUrl:profile.fotoUrl||null,senhaAtual:profile.senhaAtual||undefined
   });
   setProfile({...data.usuario,senhaAtual:""});
   if(data.reloginRequired){await logout();navigate("/login",{replace:true});return;}
   await refreshSession();
   setMessage("Dados atualizados com sucesso.");
  }catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}
 }
 async function changePassword(event){
  event.preventDefault();setError("");setMessage("");
  if(password.novaSenha!==password.confirmarSenha){setError("As novas senhas não coincidem.");return;}
  setBusy(true);
  try{
   await api.post("/auth/me/senha",password);
   setPassword({senhaAtual:"",novaSenha:"",confirmarSenha:""});
   await logout();navigate("/login",{replace:true});
  }catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}
 }
 const avatar=profile.fotoUrl;
 return <div className="page-stack account-page">
  <section className="page-heading"><div><span className="page-kicker">Sua identidade no PointVet</span><h1>Meu Usuário</h1><p>Um perfil pessoal que acompanha você em todas as empresas às quais tem acesso.</p></div></section>
  <section className="account-hero panel">
    <div className="account-photo">{avatar?<img src={avatar} alt="Foto de perfil"/>:<UserRound size={44}/>}</div>
    <div><h2>{profile.nomeExibicao||profile.nome||user?.nome}</h2><p>{profile.email}</p><span>Perfil pessoal · permissões administradas pelo estabelecimento</span></div>
  </section>
  <div className="account-tabs"><button type="button" className={tab==="perfil"?"selected":""} onClick={()=>{setTab("perfil");setError("");setMessage("");}}><UserRound size={16}/> Dados pessoais</button><button type="button" className={tab==="seguranca"?"selected":""} onClick={()=>{setTab("seguranca");setError("");setMessage("");}}><LockKeyhole size={16}/> Segurança e senha</button><button type="button" className={tab==="permissoes"?"selected":""} onClick={()=>{setTab("permissoes");setError("");setMessage("");}}><ShieldCheck size={16}/> Meus acessos</button></div>
  {error&&<p className="account-feedback account-error" role="alert">{error}</p>}
  {message&&<p className="account-feedback account-success" role="status">{message}</p>}
  {loading?<section className="panel">Carregando seu perfil...</section>:tab==="perfil"?<form className="panel account-form" onSubmit={saveProfile}>
   <div><h2>Dados pessoais</h2><p>Personalize como seu nome e sua foto aparecem no sistema.</p></div>
   <div className="account-fields">
    <label>Nome completo<input required maxLength={120} value={profile.nome||""} onChange={e=>update("nome",e.target.value)}/></label>
    <label>Nome de exibição<input maxLength={80} value={profile.nomeExibicao||""} onChange={e=>update("nomeExibicao",e.target.value)}/></label>
    <label>E-mail de acesso<input required type="email" value={profile.email||""} onChange={e=>update("email",e.target.value)}/></label>
    <label>Telefone<input maxLength={40} value={profile.telefone||""} onChange={e=>update("telefone",e.target.value)}/></label>
    <label className="account-wide"><Camera size={17}/> URL HTTPS da foto de perfil<input type="url" placeholder="https://..." value={profile.fotoUrl||""} onChange={e=>update("fotoUrl",e.target.value)}/><small>Por enquanto, utilize um endereço HTTPS de imagem. O envio direto de fotos será incluído após a integração com o armazenamento privado.</small></label>
    <label className="account-wide">Senha atual (necessária para alterar e-mail)<input type="password" autoComplete="current-password" value={profile.senhaAtual||""} onChange={e=>update("senhaAtual",e.target.value)}/></label>
   </div><button className="primary-button" type="submit" disabled={busy}>{busy?"Salvando...":"Salvar alterações"}</button>
  </form>:tab==="seguranca"?<form className="panel account-form" onSubmit={changePassword}>
   <div><h2>Alterar senha</h2><p>Por segurança, sua senha atual é obrigatória. Após a alteração, todas as sessões serão encerradas.</p></div>
   <div className="account-fields">
    <label className="account-wide">Senha atual<input type="password" required autoComplete="current-password" value={password.senhaAtual} onChange={e=>setPassword(p=>({...p,senhaAtual:e.target.value}))}/></label>
    <label>Nova senha<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password.novaSenha} onChange={e=>setPassword(p=>({...p,novaSenha:e.target.value}))}/></label>
    <label>Confirmar nova senha<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password.confirmarSenha} onChange={e=>setPassword(p=>({...p,confirmarSenha:e.target.value}))}/></label>
   </div><button className="primary-button" type="submit" disabled={busy}>{busy?"Atualizando...":"Alterar senha"}</button>
  </form>:<section className="panel account-form">
   <h2>Meus acessos</h2><p>O acesso a estabelecimentos e ao Console Interno é definido por seus vínculos e permissões, não pode ser concedido pelo próprio perfil.</p>
   {(user?.empresas||[]).map(c=><div className="account-company" key={c.id}><strong>{c.nomeFantasia}</strong><span>{c.cargo?.nome||"Usuário"}</span></div>)}
   {user?.superAdmin&&<p><ShieldCheck size={15}/> Acesso ao Console Interno do PointVet</p>}
  </section>}
 </div>;
}
