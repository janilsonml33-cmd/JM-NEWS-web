import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const hash = (texto) => createHash("sha256").update(String(texto)).digest();

export default async (req) => {
  const store = getStore("jm-news");

  // Leitura pública: qualquer visitante recebe os textos publicados
  if (req.method === "GET") {
    const dados = (await store.get("conteudo", { type: "json" })) || {};
    return json(dados);
  }

  // Publicação: exige a senha configurada no Netlify (variável EDIT_PASSWORD)
  if (req.method === "POST") {
    const senhaCorreta = process.env.EDIT_PASSWORD;
    if (!senhaCorreta) return json({ erro: "Senha de publicação não configurada no Netlify." }, 500);

    const enviada = req.headers.get("x-senha") || "";
    const ok = timingSafeEqual(hash(enviada), hash(senhaCorreta));
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800)); // atrasa tentativas erradas
      return json({ erro: "Senha incorreta." }, 401);
    }

    let corpo;
    try { corpo = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }

    const campos = corpo && corpo.campos;
    if (!campos || typeof campos !== "object") return json({ erro: "Nada para publicar." }, 400);

    const atual = (await store.get("conteudo", { type: "json" })) || {};
    for (const [chave, valor] of Object.entries(campos)) {
      if (/^c\d{1,3}$/.test(chave) && typeof valor === "string" && valor.length <= 600) {
        atual[chave] = valor.trim();
      }
    }
    await store.setJSON("conteudo", atual);
    return json({ ok: true });
  }

  return json({ erro: "Método não permitido." }, 405);
};

export const config = { path: "/api/conteudo" };
