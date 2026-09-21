# Levantamento antes da camada analítica

Feito antes de escrever qualquer gráfico, como pedido. Duas coisas primeiro:

**De onde vêm estas informações.** Esta sessão **não tem acesso à rede**, então
não consultei o Supabase diretamente. Tudo abaixo foi lido do `index.html` —
que é o que o aplicativo de fato lê e grava. Onde isso não basta (tipo exato
da coluna, colunas que existem no banco mas ninguém usa), está marcado como
**a confirmar**, e há um comando no fim para você conferir.

**O que encontrei não é só o esperado.** Há dois defeitos, um deles meu.

---

## 1. Dois defeitos encontrados

### 1.1 A data do comentário está partida em duas colunas — culpa minha

Na etapa 1 eu criei a coluna `data_coment` para o campo "Data do comentário"
do cartão. **Não vi que já existia `data_publicacao`**, gravada pela
importação de DMs desde antes de eu chegar (linha 2008 do `index.html`).

O estrago:

| Como o comentário entrou | Onde a data foi parar | Os filtros e o relatório veem? |
|---|---|---|
| Importação de planilha (DMs) | `data_publicacao` | **Não** |
| Digitada no cartão | `data_coment` | Sim |
| Colar em lote | nenhuma | Não há data |
| Adicionar à mão | nenhuma | Não há data |

Ou seja: **toda DM que você importou por planilha está hoje invisível para o
recorte por período do dashboard**, mesmo tendo data. É exatamente a
divergência entre telas que o pedido quer evitar.

É o tipo de erro que a regra "comparar antes de implementar" existe para
pegar — e eu a apliquei nas etapas 2, 3 e 4, mas não na 1.

### 1.2 Não existe hora em lugar nenhum

A função que lê as datas da planilha (`toDate`, linha 1884) **corta a hora de
propósito**:

```js
if (v instanceof Date) return v.toISOString().slice(0,10);   // fica só AAAA-MM-DD
```

Então, mesmo que a sua planilha traga `10/09/2026 14:32`, o que chega ao banco
é `2026-09-10`. **A informação de hora é descartada na porta de entrada.**

Isso decide o gráfico "Evolução por Hora": hoje ele é impossível, e pela sua
própria regra ("não inventar horário quando o dado original não existir") o
certo é mostrar o estado honesto, não um gráfico.

---

## 2. O que existe hoje no banco

### `interacoes` — comentários e DMs (a base de tudo)

| Campo | Para que serve | Quem preenche |
|---|---|---|
| `cliente_id` | de quem é | todos os caminhos |
| `rede_id` | Instagram, Facebook… | importação, colar em lote, cartão |
| `origem` | `Feed` ou `DM` | todos |
| `autor`, `texto` | quem falou e o quê | todos |
| `resposta` | o rascunho/resposta | cartão, importação de DM |
| `sentimento_id` | → `categorias_sentimento` | IA, cartão, importação |
| `produto_id`, `editoria_id` | → `produtos`, `editorias` | IA, cartão, importação |
| `triagem` | estado de trabalho | cartão |
| `link_conteudo` | o post de origem, **como texto** | colar em lote, cartão |
| `data_publicacao` | data — **só a importação grava** | importação de DM |
| `data_coment` | data — **criada por mim na etapa 1** | cartão |
| `ia_em`, `ia_triagem`, `ia_motivo`, `ia_juridico` | o que a IA achou | IA |

**Não existe:** hora, `post_id`, `projeto_id`.

### `publicacoes` — o desempenho dos posts

Esta é a boa notícia do levantamento. **As métricas de engajamento já existem
e já são importadas**, e ninguém nunca as mostrou:

`cliente_id`, `rede_id`, `produto_id`, `editoria_id`, `data_post`, `link`,
`formato`, `status`, e **16 colunas de métrica**: visualizações, alcance,
curtidas, comentários, compartilhamentos, salvamentos, engajamento e taxa de
engajamento — cada uma em versão **orgânica e paga**.

Hoje o aplicativo carrega essa tabela inteira e usa **só para contar quantos
posts cada rede tem** (linha 1813).

### As outras

`clientes`, `redes`, `produtos`, `editorias`, `categorias_sentimento`,
`perfis`. Todas por `cliente_id`.

---

## 3. A matriz pedida

| Gráfico | Fonte atual | Campo usado | Já funciona? | O que falta |
|---|---|---|---|---|
| Evolução diária | `interacoes` | `data_publicacao` / `data_coment` | **Parcial** | unir as duas colunas; colar em lote não grava data nenhuma |
| Volume mensal | `interacoes` | idem | **Parcial** | idem; e o texto do card fala de "volume publicado", que é outra coisa |
| Dia da semana | `interacoes` | idem | **Não** | sai da mesma data; falta implementar |
| Evolução por hora | — | **não existe** | **Não** | a importação descarta a hora; precisa parar de descartar |
| Sentimento | `interacoes` → `categorias_sentimento` | `sentimento_id` | **Sim** | só falta ligar na tela da rede; já calculado no dashboard |
| Termos | `interacoes` | `texto` | **Não** | implementar + lista de palavras a ignorar |
| Posts mais engajados | `publicacoes` | as 16 métricas | **Dados sim, tela não** | exibir; e decidir qual métrica é "engajamento" |
| Hashtags | `interacoes` / `publicacoes` | `texto` | **Não** | sai do texto; nunca implementado |

---

## 4. Decisões que eu não vou tomar sozinho

### 4.1 Qual coluna de data fica

Precisa sobrar uma só. A migração é aditiva nos dois caminhos — nada é
apagado, só copiado.

- **`data_publicacao`** (recomendo): é a que já existia antes de mim. A regra
  "não duplicar o que existe" diz que quem chegou depois cede. Serve para
  comentário e para DM sem soar estranho.
- **`data_coment`**: nome mais claro para comentário, mas foi eu que criei, e
  manter a minha em detrimento da sua é a decisão errada por padrão.

### 4.2 Existe "Projeto" entre Cliente e Rede?

O seu pedido descreve **Cliente → Projeto → Rede**. O MUVUCA hoje tem
**Cliente → Rede**: o módulo se chama "Projetos", mas cada *cliente* é um
workspace, e não há tabela de projeto nem `projeto_id`.

- **Tratar cliente como o projeto** (recomendo por ora): zero migração, e
  nada hoje precisa de dois níveis.
- **Criar a camada de projeto de verdade**: um cliente passa a ter vários
  projetos, e toda consulta ganha mais um filtro. É uma mudança grande, e só
  vale se você já tem cliente com mais de um projeto em vista.

### 4.3 O que conta como "engajamento" no ranking de posts

As 16 métricas estão lá, mas "engajamento" precisa de uma definição sua. As
colunas `engaj_org` / `engaj_pago` já vêm prontas da planilha — se for isso,
uso elas e mostro a fórmula na tela. Se for outra coisa (por exemplo curtidas
+ comentários + compartilhamentos + salvamentos), me diga a conta.

Enquanto não houver definição, o card mostra o estado honesto, não um número
inventado.

### 4.4 Ligar comentário ao post

Hoje a ligação é por **texto**: `interacoes.link_conteudo` contra
`publicacoes.link`. Um espaço a mais ou um `?utm_source=` no fim e a ligação
se perde em silêncio.

O certo é um `publicacao_id` de verdade em `interacoes`, preenchido por
correspondência de link na importação e editável no cartão. É aditivo.

---

## 5. Para conferir o banco de verdade

Eu não consigo consultar o seu Supabase daqui. **Rode o comando abaixo** e me
mande o resultado — ele só lê, não altera nada.

1. Entre em **https://supabase.com**, abra o projeto do **MUVUCA**.
2. No menu da esquerda, clique em **`SQL Editor`** e depois em **`New query`**.
3. Cole isto e clique em **`Run`**:

```sql
select table_name  as tabela,
       column_name as coluna,
       data_type   as tipo,
       is_nullable as aceita_vazio
from information_schema.columns
where table_schema = 'public'
  and table_name in ('interacoes','publicacoes','clientes','redes',
                     'produtos','editorias','categorias_sentimento')
order by table_name, ordinal_position;
```

**O que você vai ver:** uma tabela com uma linha por coluna. Pode copiar tudo
e colar na conversa.

Com isso eu confirmo três coisas que hoje são suposição: se `data_publicacao`
é `date` ou `timestamp` (se for timestamp, talvez haja hora guardada e o
problema seja só na leitura), se há colunas que o aplicativo nunca usa, e se
existe algum `created_at` que sirva de data de importação.
