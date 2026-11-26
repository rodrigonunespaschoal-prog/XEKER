import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const gameEngine = require("../functions/gameEngine.js");

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://xeker.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/move",
      engine: "functions/gameEngine.js",
      usage: "Envie POST com { state, side, cmd } para aplicar comando ou com dados da jogada para registo."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const cmd = body.cmd || body.action;
    const senderSide = body.side;

    if (cmd && senderSide) {
      const currentState =
        body.state ||
        gameEngine.createInitialMatchState({
          whiteUid: body.whiteUid || "white-player",
          blackUid: body.blackUid || "black-player",
          whiteName: body.whiteName || "Brancas",
          blackName: body.blackName || "Pretas",
          unrated: Boolean(body.unrated)
        });

      const result = gameEngine.applyCommandToState(currentState, senderSide, cmd);
      if (!result || !result.valid) {
        return res.status(400).json({
          ok: false,
          valid: false,
          error: "Comando inválido para o estado atual da partida."
        });
      }

      return res.status(200).json({
        ok: true,
        valid: true,
        engine: "functions/gameEngine.js",
        nextState: result.nextState,
        publicView: result.publicView,
        whiteView: result.whiteView,
        blackView: result.blackView,
        fxEvent: result.fxEvent,
        summary: result.summary,
        timestamp: Date.now()
      });
    }

    return res.status(200).json({
      ok: true,
      validated: true,
      engine: "functions/gameEngine.js",
      move: body,
      timestamp: Date.now()
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err && err.message ? err.message : "Payload JSON inválido."
    });
  }
}
