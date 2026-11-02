// events.json を speeches.json に照らして検査する。build-events の判定関数は使わない。
//
//   npm run kaigiroku:verify-events -- ekimae

import fs from "fs"
import path from "path"
import { loadKohoIssues } from "./koho-source"
import type { Excerpt } from "./excerpt"
import { ACTIONS, ACTION_PHRASES, CHAIR_ROLE, KOHO_ACTOR, LAYERS, MEMBER_ROLE, OBJECTS, type TraceEvent } from "./event-schema"

const ROOT = process.cwd()
const squash = (s: string) => s.replace(/\s+/g, "")
interface SpeechRow { date: string; speaker: string; role: string; page: number; agenda: string; text: string }

function main() {
  const theme = process.argv[2]
  const dir = path.join(ROOT, "content", "traces")
  const events = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.events.json`), "utf-8")) as TraceEvent[]
  const excerpts = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.excerpts.json`), "utf-8")) as Excerpt[]
  const failures: string[] = []
  const fail = (e: TraceEvent, rule: string) => failures.push(`[${rule}] ${e.id} ${e.date} ${e.actor.name} ${e.actor.role} layer=${e.layer}`)
  const known = new Map(ACTION_PHRASES.flatMap(a => a.phrases.map(p => [p, a.action] as const)))

  const issues = loadKohoIssues()

  for (const e of events) {
    if (e.source_type !== "kaigiroku" && e.source_type !== "koho") { fail(e, "source_typeが無い"); continue }
    if (e.source_type === "koho") {
      // 広報は発言者がいないので、号・ページ・本文に照らす
      const issue = issues.find(i => i.date === e.date)
      const page = issue?.pages.find(p => p.page === e.source.page)
      if (!issue || !page) { fail(e, "広報の号かページが実在しない"); continue }
      const body = squash(page.text)
      if (!body.includes(e.source.quote)) fail(e, "広報の引用が本文に無い")
      if (!body.includes(e.source.sentence)) fail(e, "広報の一文が本文に無い")
      if (e.source.url !== `${issue.url}#page=${page.page}`) fail(e, "広報のURLが違う")
      if (e.actor.name !== KOHO_ACTOR.name || e.actor.role !== KOHO_ACTOR.role) fail(e, "広報のactorが違う")
      if (e.layer === "debate") fail(e, "広報の記事がdebate")
      if (e.source.session_key !== null || e.source.speech_index !== null) fail(e, "広報に会議録の参照がある")
      if (e.action !== null && !ACTIONS.includes(e.action)) fail(e, "actionが語彙に無い")
      if (e.action_phrase && !e.source.sentence.includes(e.action_phrase)) fail(e, "言い回しが一文に無い")
      if (e.objects.some(o => !OBJECTS.includes(o))) fail(e, "objectが語彙に無い")
      for (const c of e.causes) if (!e.source.sentence.includes(c.reason) || !e.source.sentence.includes(c.effect)) fail(e, "因果が原文に無い")
      continue
    }
    if (e.source.session_key === null || e.source.speech_index === null) { fail(e, "会議録の参照が無い"); continue }
    const speeches = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "kaigiroku", e.source.session_key, "speeches.json"), "utf-8")) as SpeechRow[]
    const s = speeches[e.source.speech_index]
    if (!s) { fail(e, "発言が実在しない"); continue }

    // layer と actor を、event に書かれた役職ではなく出典の発言者で判定する
    if (e.actor.name !== s.speaker || e.actor.role !== s.role) fail(e, "actorが出典の発言者と違う")
    if (MEMBER_ROLE.test(s.role) && e.layer !== "debate") fail(e, "議員の発言がdebate以外")
    if (!MEMBER_ROLE.test(s.role) && e.layer === "debate") fail(e, "議員以外の発言がdebate")
    if (CHAIR_ROLE.test(s.role) && e.layer !== "fact") fail(e, "議長の発言がfact以外")
    if (!LAYERS.includes(e.layer)) fail(e, "layerが語彙に無い")

    if (e.date !== s.date) fail(e, "日付が出典と違う")
    if (e.source.agenda !== s.agenda) fail(e, "議事が出典と違う")
    const body = squash(s.text)
    if (!body.includes(squash(e.source.quote))) fail(e, "引用が本文に無い")
    if (!body.includes(e.source.sentence)) fail(e, "一文が本文に無い")
    if (!e.source.url.endsWith(`#page=${e.source.page}`)) fail(e, "URLとページが違う")

    if (e.source.excerpt_id) {
      const x = excerpts[Number(e.source.excerpt_id.slice(1)) - 1]
      if (!x || x.sessionKey !== e.source.session_key || x.speaker !== s.speaker || x.date !== s.date) fail(e, "抜粋IDが出典と違う")
    } else if (e.action !== "議決") fail(e, "抜粋IDが無いのに議決以外")

    if (e.result && !body.includes(e.result)) fail(e, "採決結果が本文に無い")
    if (e.result && !CHAIR_ROLE.test(s.role)) fail(e, "議長以外の採決結果")
    if (e.result && e.bill && !s.text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).includes(e.bill)) fail(e, "採決の発言に議案番号が無い")
    if (e.action !== null && !ACTIONS.includes(e.action)) fail(e, "actionが語彙に無い")
    if (e.action_phrase) {
      if (!e.source.sentence.includes(e.action_phrase)) fail(e, "言い回しが一文に無い")
      if (e.action !== "議決" && known.get(e.action_phrase) !== e.action) fail(e, "対応表と違う")
    }
    if (e.objects.some(o => !OBJECTS.includes(o))) fail(e, "objectが語彙に無い")
    for (const a of e.amounts) {
      const half = e.source.sentence.replace(/[０-９，]/g, c => (c === "，" ? "," : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
      if (!half.includes(a.raw)) fail(e, "金額が一文に無い")
    }
    for (const c of e.causes) {
      const scope = c.scope === "前の文" ? body : e.source.sentence
      if (!scope.includes(c.reason) || !scope.includes(c.effect)) fail(e, "因果が原文に無い")
      if (c.certainty !== "断定" && c.certainty !== "推測") fail(e, "断定/推測の区別が無い")
      if (c.stated_by !== `${s.speaker} ${s.role}`) fail(e, "因果の述者が違う")
      if (MEMBER_ROLE.test(s.role) && !c.hearsay) fail(e, "議員の発言の因果が伝聞になっていない")
    }
  }

  const seen = new Set<string>()
  for (const e of events) {
    if (seen.has(e.id)) failures.push(`[idが重複] ${e.id}`)
    seen.add(e.id)
  }
  console.log(`検査 ${events.length} 件 / 不合格 ${failures.length}`)
  failures.slice(0, 40).forEach(f => console.log(`  ${f}`))
  if (failures.length > 0) process.exit(1)
}

main()
