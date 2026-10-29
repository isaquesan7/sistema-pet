import {Component} from "react";

/** Evita tela vazia caso o workspace do PDV lance erro de renderizacao.
 * Nao reloga, nao refaz vendas, nao cancela operacoes do servidor. */
export default class PdvErrorBoundary extends Component {
  state={failed:false};

  static getDerivedStateFromError(){
    return {failed:true};
  }

  componentDidCatch(error){
    // Apenas erro de codigo; nunca gravar dados de vendas, tutores ou tokens.
    console.error("[PointVet PDV] Falha de interface:",error?.name||"RenderError");
  }

  render(){
    if(!this.state.failed)return this.props.children;
    return <section className="page-stack pdv-page" role="alert">
      <div className="panel" style={{padding:24,maxWidth:680}}>
        <h2>Não foi possível abrir esta tela do PDV</h2>
        <p>A operação não foi confirmada por esta tela. Se você estava finalizando uma venda, consulte o histórico antes de tentar novamente.</p>
        <button className="primary-button" type="button" onClick={()=>this.setState({failed:false})}>Voltar à central do PDV</button>
      </div>
    </section>;
  }
}
