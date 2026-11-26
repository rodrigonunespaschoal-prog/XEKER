# Xeker — Firebase Cloud Functions (`functions/`)

Coloque os arquivos desta pasta dentro da pasta `functions/` na raiz do projeto do Xeker:

- `package.json`: dependências e versão do Node.js para o Firebase Functions v2.
- `index.js`: gatilhos do Firestore (`onMatchmakingJoin` e `processMatchCommand`) que atuam como host autoritativo e aplicam Elo/vitórias/derrotas.
- `gameEngine.js`: lógica de tabuleiro, baralho, avaliação de mãos de pôquer, combate, turnos, relógios e cálculo de Elo.

### Como instalar e publicar

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```
