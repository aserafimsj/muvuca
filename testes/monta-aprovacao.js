// Monta uma pagina que renderiza SO a tela de Aprovacao, com um Supabase de
// mentira que guarda de verdade o que foi gravado. Assim da para abrir num
// navegador real, sem login e sem tocar no banco.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(<App\/>\);/, '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

// O mes da bancada e fixo (setembro/2026) para as contagens nao mudarem com
// o passar do tempo real. O teste navega ate ele antes de contar.
const MES = '2026-09';
const d = n => `${MES}-${String(n).padStart(2,'0')}`;

/* Cada peca existe para provar uma coisa:
     1 aprovado          -> entra na barra de progresso
     2 aprovado          -> idem
     3 enviado           -> "com o cliente"
     4 visualizado       -> "com o cliente" tambem (nao so "enviado")
     5 reenviado         -> "com o cliente" tambem
     6 ajuste_solicitado -> "em ajuste"
     7 em_alteracao      -> "em ajuste" tambem
     8 rascunho          -> "ainda internos"
     9 em_revisao        -> "ainda internos" tambem
    10 arquivado         -> fora de TODA conta
    11 outro mes         -> nao aparece em setembro
    12 sem data          -> nao aparece em mes nenhum; a tela tem que avisar
   Logo: total 9, aprovados 2, com o cliente 3, em ajuste 2, internos 2. */
const PECAS = [
  {id:1,  cliente_id:1, status:'aprovado',   data_prevista:d(2),  titulo:'Card institucional',
   formato:'Feed',      rede_id:1, produto_id:1, editoria_id:1, legenda:'Legenda do institucional.',
   hashtags:'#TesouroDireto', campanha:null, observacoes:null, versao:1, arquivado:false,
   hora_prevista:'09:00:00', cta:null, responsavel:'Ana', criado_em:'2026-08-30T10:00:00Z'},
  {id:2,  cliente_id:1, status:'aprovado',   data_prevista:d(4),  titulo:'Reels de educação',
   formato:'Reels',     rede_id:1, produto_id:2, editoria_id:1, legenda:null, hashtags:null,
   campanha:'Grandes Sonhos', observacoes:null, versao:2, arquivado:false, hora_prevista:null,
   cta:null, responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:3,  cliente_id:1, status:'enviado',    data_prevista:d(9),  titulo:'5 coisas que você precisa saber',
   formato:'Carrossel', rede_id:1, produto_id:1, editoria_id:1,
   legenda:'Você já conhece o Tesouro Selic?', hashtags:'#TesouroDireto #Investimentos',
   campanha:null, observacoes:'Conferir o número da taxa antes de enviar.', versao:1,
   arquivado:false, hora_prevista:'18:30:00', cta:'Arraste para o lado', responsavel:'Bruno',
   criado_em:'2026-08-30T10:00:00Z'},
  {id:4,  cliente_id:1, status:'visualizado',data_prevista:d(11), titulo:'Stories da semana',
   formato:'Stories',   rede_id:1, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:5,  cliente_id:1, status:'reenviado',  data_prevista:d(13), titulo:'Post sobre IPCA+',
   formato:'Feed',      rede_id:1, produto_id:2, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:3, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:6,  cliente_id:1, status:'ajuste_solicitado', data_prevista:d(16), titulo:'Card de taxas',
   formato:'Feed',      rede_id:2, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:7,  cliente_id:1, status:'em_alteracao', data_prevista:d(18), titulo:'Vídeo explicativo',
   formato:'Vídeo',     rede_id:1, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:2, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:8,  cliente_id:1, status:'rascunho',   data_prevista:d(22), titulo:null,
   formato:null,        rede_id:null, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:9,  cliente_id:1, status:'em_revisao', data_prevista:d(25), titulo:'Carrossel de fim de mês',
   formato:'Carrossel', rede_id:1, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:10, cliente_id:1, status:'aprovado',   data_prevista:d(27), titulo:'Peça arquivada',
   formato:'Feed',      rede_id:1, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:true, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:11, cliente_id:1, status:'rascunho',   data_prevista:'2026-10-05', titulo:'Peça de outubro',
   formato:'Feed',      rede_id:1, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
  {id:12, cliente_id:1, status:'rascunho',   data_prevista:null, titulo:'Peça sem data marcada',
   formato:null,        rede_id:null, produto_id:null, editoria_id:null, legenda:null, hashtags:null,
   campanha:null, observacoes:null, versao:1, arquivado:false, hora_prevista:null, cta:null,
   responsavel:null, criado_em:'2026-08-30T10:00:00Z'},
];

const EVENTOS = [
  {id:1, conteudo_id:3, de:null,        para:'rascunho',   quem:'Bruno', criado_em:'2026-08-30T10:00:00Z'},
  {id:2, conteudo_id:3, de:'rascunho',  para:'em_revisao', quem:'Bruno', criado_em:'2026-09-01T11:00:00Z'},
  {id:3, conteudo_id:3, de:'em_revisao',para:'enviado',    quem:'Ana',   criado_em:'2026-09-02T09:30:00Z'},
];

const CFG = {
  redes:      [{id:1,nome:'Instagram'},{id:2,nome:'Facebook'}],
  produtos:   [{id:1,nome:'Selic'},{id:2,nome:'IPCA+'}],
  editorias:  [{id:1,nome:'Educativo'}],
  sentimentos:[],
};

const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${css}</style>
<script src="./node_modules/react/umd/react.development.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
<script>
  window.__pecas = ${JSON.stringify(PECAS)};
  window.__eventos = ${JSON.stringify(EVENTOS)};
  window.__gravacoes = [];
  window.__erro = null;
  let proximoId = 100;

  /* Supabase de mentira que GUARDA de verdade: insert devolve a linha com id
     novo, update altera a linha guardada. Um duble que so devolve {error:null}
     deixaria passar um insert que perde campo pelo caminho. */
  function tabela(nome){
    const dados = () => nome === 'conteudos' ? window.__pecas
                      : nome === 'conteudo_eventos' ? window.__eventos : [];
    let filtradas = null;
    const api = {
      select(){ filtradas = dados().slice(); return api; },
      eq(campo, valor){
        if(filtradas) filtradas = filtradas.filter(l => String(l[campo]) === String(valor));
        return api;
      },
      order(campo, opc){
        if(filtradas) filtradas.sort((a,b) => {
          const x = a[campo], y = b[campo];
          if(x === y) return 0;
          if(x === null || x === undefined) return 1;
          if(y === null || y === undefined) return -1;
          return ((x > y) ? 1 : -1) * ((opc && opc.ascending === false) ? -1 : 1);
        });
        return api;
      },
      single(){ return Promise.resolve({data: (filtradas||[])[0] || null, error:null}); },
      then(res){
        return Promise.resolve(window.__erro
          ? {data:null, error:{message: window.__erro}}
          : {data: filtradas || [], error:null}).then(res);
      },
    };
    return {
      select: () => api.select(),
      insert(v){
        const linhas = (Array.isArray(v) ? v : [v]).map(x => ({id: proximoId++, ...x}));
        window.__gravacoes.push({tabela:nome, acao:'insert', linhas});
        dados().push(...linhas);
        filtradas = linhas;
        return { select: () => api, then: (r) => Promise.resolve({data:linhas, error:null}).then(r) };
      },
      update(v){
        return { eq(campo, valor){
          window.__gravacoes.push({tabela:nome, acao:'update', id:valor, valores:v});
          dados().forEach(l => { if(String(l[campo]) === String(valor)) Object.assign(l, v); });
          return Promise.resolve({error:null});
        }};
      },
    };
  }
  window.supabase = { createClient: () => ({
    from: tabela,
    auth: { getSession: () => Promise.resolve({data:{session:null}}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) },
  })};
</script>
</head>
<body style="padding:20px;background:#F6F6F3">
<div id="root"></div>
<script type="text/babel">
${src}

function BancadaAprovacao(){
  const [cenario, setCenario] = useState('cheio');
  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button className="btn" id="b-cheio" onClick={()=>{window.__erro=null; setCenario('cheio');}}>cheio</button>
        <button className="btn" id="b-erro"  onClick={()=>{window.__erro='relation "public.conteudos" does not exist'; setCenario('erro');}}>erro</button>
      </div>
      <Aprovacoes key={cenario} clienteId={1} clienteNome="Tesouro Direto"
        cfg={${JSON.stringify(CFG)}} perfil={{nome:'Adilson'}} />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<BancadaAprovacao/>);
</script></body></html>`;

fs.writeFileSync(__dirname + '/aprovacao.html', pagina);
console.log('aprovacao.html montada');
