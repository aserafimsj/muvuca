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
| `teste-classify.js` | A função da IA contra respostas simuladas: boa, cortada no meio, recusada, sem JSON, JSON inválido, erro da Anthropic e gateway quebrado. Nenhuma pode virar falha silenciosa. |
| `teste-filtros.js` | A regra "este comentário passa no filtro?" sem navegador. Cobre os casos chatos: comentário sem data num recorte de datas, campo vazio que não pode virar coringa, filtros somados com E e não OU. |
| `teste-dashboard.js` | As contas do relatório sem navegador: os onze recortes de período, o agrupamento e a série diária. Número errado em relatório não aparece como erro — aparece como um número plausível e errado. |
| `monta-dash.js` / `roda-dash.js` | Montam e testam o dashboard num navegador real, com 55 comentários espalhados em 40 dias, dois dias parados de propósito, três sem data e um na lixeira. Conferem que as somas fecham e que a lixeira não entra na conta. |
| `monta-bancada.js` | Monta uma página de teste com a tela do Community, dados falsos e um Supabase de mentira. |
| `roda-bancada.js` | Abre essa página num navegador de verdade e confere o comportamento: etiquetas da IA, campos, gravação só ao sair do campo, Gerar de novo, abas, lixeira, exclusão com confirmação, pastilhas de filtro. Falha se houver qualquer erro no console. Remonta a bancada sozinho antes de rodar. |

`roda-bancada.js` também salva `cartao.png`, útil para olhar o resultado.

## Regra

Um teste que falha por culpa da própria bancada não vale nada. Se algo falhar,
confirme primeiro que o defeito é do MUVUCA, e não do arquivo de teste.
