# Bancada de teste do MUVUCA

Esta pasta **não vai para a hospedagem** (ver `../.vercelignore`). É só para
quem estiver mexendo no código.

## Por que existe

O `index.html` usa Babel no próprio navegador. Não há compilação, então **não
existe nada que avise sobre erro antes de a página abrir** — um erro de digitação
vira tela branca para o usuário, sem mensagem. Esta bancada é o aviso que falta.

Ela também roda a função da IA (`api/classify.js`) sem rede e sem gastar
dinheiro, simulando as respostas da Anthropic — inclusive as que dão errado.

## Como rodar

```
cd testes
npm install
npm run teste
```

## O que cada arquivo faz

| Arquivo | O que verifica |
|---|---|
| `valida-jsx.js` | Se o `index.html` compila. Pega erro de digitação que deixaria a tela branca. |
| `teste-esquema.js` | **Se toda coluna que o código grava existe mesmo no banco — tabela por tabela.** Cada `.update()` e `.insert()` é atribuído à tabela que ele realmente toca, e *todas* as chaves do objeto são lidas, não só a primeira. Nasceu de um erro real: o código passou a gravar `ia_em` e companhia em colunas que nunca foram criadas — a IA respondia, o custo era cobrado, e a gravação morria em silêncio. Passou despercebido por várias etapas. Compara contra `esquema-real.json`. |
| `monta-app.js` / `roda-app.js` | **O aplicativo inteiro**, do login ao último módulo, com um Supabase de mentira. As outras bancadas testam componentes isolados; esta é a única que exercita a *ligação* entre eles: prop esquecida, módulo sem rota, dado de um cliente vazando para outro. |
| `teste-classify.js` | A função da IA contra respostas simuladas: boa, cortada no meio, recusada, sem JSON, JSON inválido, erro da Anthropic e gateway quebrado. Nenhuma pode virar falha silenciosa. |
| `teste-filtros.js` | A regra "este comentário passa no filtro?" sem navegador. Cobre os casos chatos: comentário sem data num recorte de datas, campo vazio que não pode virar coringa, filtros somados com E e não OU. |
| `teste-estados.js` | Os estados dos cards de análise. Impede que "sem dados", "falta preencher tal campo" e "a tela ainda não foi feita" voltem a virar um único "Aguardando dados" genérico. |
| `audita-telas.js` | Abre as cinco telas em 375, 768 e 1150px e **reprova** se houver rolagem horizontal, elemento passando da borda ou alvo de toque menor que 32px. Reprova em vez de só relatar, porque regressão de responsividade acontece justamente na próxima alteração de CSS. |
| `teste-conteudos.js` | O casamento entre comentário e post. O mesmo link chega escrito de oito formas diferentes (sem `www`, sem barra no fim, com rabicho de campanha…) e todas têm que casar — comparando o texto cru, a contagem dá zero em silêncio. Testa também a soma de orgânico com pago. |
| `monta-conteudos.js` / `roda-conteudos.js` | Montam e testam o mural num navegador real: contagem por post com links escritos diferente, comentário na lixeira que não conta, aviso de comentário órfão, incorporação do post e paginação. |
| `teste-csv.js` | A exportação CSV sem navegador. O caso central é o comentário com ponto e vírgula, aspas e quebra de linha dentro do texto: o teste escreve o arquivo, lê de volta com um leitor de CSV de verdade e confere que tudo voltou inteiro. Arquivo quebrado assim ainda *abre* na planilha — só abre errado, e ninguém percebe. |
| `teste-dashboard.js` | As contas do relatório sem navegador: os onze recortes de período, o agrupamento e a série diária. Número errado em relatório não aparece como erro — aparece como um número plausível e errado. |
| `monta-dash.js` / `roda-dash.js` | Montam e testam o dashboard num navegador real, com 55 comentários espalhados em 40 dias, dois dias parados de propósito, três sem data e um na lixeira. Conferem que as somas fecham e que a lixeira não entra na conta. |
| `teste-aprovacao.js` | As contas do módulo de Aprovação sem navegador: a aritmética de mês (dezembro + 1 tem que virar janeiro do ano seguinte; janeiro + 1 não pode "estourar" para março), o resumo do painel, e os **caminhos de status** — todo estado precisa ter saída, todo destino precisa existir, de todo estado tem que dar para voltar atrás, e partindo de "rascunho" tem que dar para chegar em todos. Estado sem volta é peça presa por engano de clique. |
| `monta-aprovacao.js` / `roda-aprovacao.js` | Montam e testam a tela de Aprovação num navegador real, com um Supabase de mentira que **guarda de verdade** — um dublê que só devolve `{error:null}` deixaria passar um insert que perde campo pelo caminho. Verificam que mover o status grava **duas** coisas (a peça e o histórico), que campo vazio vira `null` e não `""`, e que peça sem data some do mês *mas* é anunciada. |
| `teste-manha.js` | A tela Manhã sem navegador e sem rede. Confere que **as regras da CVM existem em um arquivo só** (nenhum outro pode ter cópia do texto), que os doze tipos de DM e a lista do "PARE" estão no prompt, que a lista de palavras proibidas **barra** as promessas de retorno e **deixa passar** as doze respostas certas, que uma sugestão barrada vira ESCALAR *sem texto*, e que o recebimento exige senha, não duplica e não gasta IA duas vezes. |
| `monta-manha.js` / `roda-manha.js` | Montam e testam a tela Manhã num navegador real. A verificação central: **em nenhum cartão o bloco vermelho de ESCALAR convive com uma caixa de resposta.** Testam também copiar, salvar o texto ajustado, sair da fila, os filtros, o estado vazio e o erro de tabela faltando. |
| `monta-bancada.js` | Monta uma página de teste com a tela do Community, dados falsos e um Supabase de mentira. |
| `roda-bancada.js` | Abre essa página num navegador de verdade e confere o comportamento: etiquetas da IA, campos, gravação só ao sair do campo, Gerar de novo, abas, lixeira, exclusão com confirmação, pastilhas de filtro. Falha se houver qualquer erro no console. Remonta a bancada sozinho antes de rodar. |

`roda-bancada.js` também salva `cartao.png`, útil para olhar o resultado.

## Regras aprendidas na marra

**Um teste que falha por culpa da própria bancada não vale nada.** Se algo
falhar, confirme primeiro que o defeito é do MUVUCA, e não do arquivo de
teste. Já aconteceu nove vezes nesta obra — as contagens estavam erradas no
teste, não no código.

**Dublê mal instalado testa a coisa errada.** `navigator.clipboard` é um
`getter` só de leitura: atribuir por cima falha **em silêncio**, e o teste
passa a medir a área de transferência de verdade, que em `file://` nem
existe. Para substituir, `Object.defineProperty`.

**Pior que um teste que falha é um que passa sem testar.** O texto do
comentário mora num `<textarea>`, e conteúdo de textarea é **valor**, não
texto:

- `innerText` **não** enxerga → um teste do tipo "isto não deve aparecer"
  passa sempre, sem testar nada;
- `textContent` enxerga o valor **inicial**, mas não acompanha edição → passa
  sobre dado velho.

O certo é `inputValue()`. Dois testes desta bancada passavam por engano por
causa disso.

**Bancada desatualizada dá falso alarme nos dois sentidos** — acusa defeito
já corrigido, ou esconde um que acabou de entrar. Por isso `roda-*.js`
remonta a própria página antes de rodar.
